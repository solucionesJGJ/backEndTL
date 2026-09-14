import axios from "axios";
import type { Request, Response } from "express";

import { Op } from "sequelize";

import {
  BillingDocument,
  BillingDocumentBatch,
  BillingDocumentItem,
  Client,
  Garment,
  GarmentBatch,
  GarmentBatchItem,
  GarmentIncident,
  MovementStatus,
  sequelize,
} from "../models/index.js";

import {
  createEngineInvoice,
  processEngineInvoice,
  type BillingEngineInvoicePayload,
} from "../services/billing-engine.service.js";

import { getBatchGarmentStatusBalance } from "../service/garment-movement.service.js";

/**
 * =========================================================
 * CONSTANTES
 * =========================================================
 */

const TAX_RATE = 19;

/**
 * Estados que bloquean un lote para otra facturación.
 *
 * cancelled queda fuera porque permite reutilizar
 * nuevamente los lotes.
 */
const BLOCKING_BILLING_STATUSES = [
  "draft",
  "confirmed",
  "pending_engine",
  "sent_to_engine",
  "engine_processing",
  "completed",
  "error",
];

/**
 * =========================================================
 * HELPERS
 * =========================================================
 */

/**
 * CLP no utiliza normalmente decimales.
 *
 * Dejamos el modelo con DECIMAL por flexibilidad,
 * pero los cálculos comerciales de esta etapa
 * quedan redondeados a pesos enteros.
 */
function roundMoney(value: number) {
  return Math.round(Number(value || 0));
}

/**
 * Los valores comerciales almacenados por TL
 * incluyen IVA.
 *
 * La facturación trabaja con valor neto para
 * evitar volver a cargar el 19% sobre un precio
 * que ya lo contiene.
 */
function getNetValueFromVatIncluded(grossValue: number) {
  return roundMoney(Number(grossValue || 0) / (1 + TAX_RATE / 100));
}

/**
 * Valida porcentaje entre 0 y 100.
 */
function isValidDiscount(value: unknown) {
  const number = Number(value);

  return Number.isFinite(number) && number >= 0 && number <= 100;
}

/**
 * Calcula una línea comercial.
 */
function calculateBillingLine(
  quantity: number,
  unitValue: number,
  discountPercentage = 0,
) {
  const lineSubtotal = roundMoney(quantity * unitValue);

  const discountAmount = roundMoney(lineSubtotal * (discountPercentage / 100));

  const lineTotal = roundMoney(lineSubtotal - discountAmount);

  return {
    lineSubtotal,
    discountAmount,
    lineTotal,
  };
}

/**
 * Verifica que el cliente tenga
 * antecedentes tributarios suficientes.
 */
function getMissingBillingFields(client: Client) {
  const missing: string[] = [];

  if (!client.rut?.trim()) {
    missing.push("RUT");
  }

  if (!client.legal_name?.trim()) {
    missing.push("razón social");
  }

  if (!client.business_activity?.trim()) {
    missing.push("giro");
  }

  if (!client.address?.trim()) {
    missing.push("dirección");
  }

  if (!client.commune?.trim()) {
    missing.push("comuna");
  }

  if (!client.city?.trim()) {
    missing.push("ciudad");
  }

  return missing;
}

/**
 * Recalcula los totales de un documento
 * exclusivamente desde sus items.
 *
 * Nunca confiamos en totales enviados por React.
 */
async function recalculateBillingDocument(
  billingDocumentId: string,
  transaction?: any,
) {
  const items = await BillingDocumentItem.findAll({
    where: {
      billing_document_id: billingDocumentId,
    },

    transaction,
  });

  let subtotal = 0;
  let discountTotal = 0;
  let netAmount = 0;

  for (const item of items) {
    subtotal += Number(item.line_subtotal || 0);

    discountTotal += Number(item.discount_amount || 0);

    netAmount += Number(item.line_total || 0);
  }

  subtotal = roundMoney(subtotal);

  discountTotal = roundMoney(discountTotal);

  netAmount = roundMoney(netAmount);

  const taxAmount = roundMoney((netAmount * TAX_RATE) / 100);

  const totalAmount = roundMoney(netAmount + taxAmount);

  const document = await BillingDocument.findByPk(billingDocumentId, {
    transaction,
  });

  if (!document) {
    throw new Error("Documento de facturación no encontrado");
  }

  await document.update(
    {
      subtotal,
      discount_total: discountTotal,

      net_amount: netAmount,

      tax_rate: TAX_RATE,

      tax_amount: taxAmount,

      total_amount: totalAmount,
    },
    {
      transaction,
    },
  );

  return document;
}

/**
 * =========================================================
 * RESOLUCIÓN COMERCIAL DE UNA PRENDA DEL LOTE
 * =========================================================
 *
 * Cantidad facturable:
 *
 * - saldo que terminó normalmente en CERRADO
 * - más incidencias marcadas BILLABLE
 *
 * Una incidencia PENDING_REVIEW bloquea el lote completo
 * hasta que administración tome una decisión comercial.
 */
async function getBatchItemBillingResolution(
  batchId: string,
  garmentId: string,
  transaction?: any,
) {
  const closedStatus = await MovementStatus.findOne({
    where: {
      code: "CERRADO",
    },

    transaction,
  });

  if (!closedStatus) {
    throw new Error("No existe estado CERRADO");
  }

  const closedQuantity = await getBatchGarmentStatusBalance(
    batchId,
    garmentId,
    closedStatus.id,
    transaction,
  );

  const incidents = await GarmentIncident.findAll({
    where: {
      batch_id: batchId,

      garment_id: garmentId,

      resolution_status: "RESOLVED",
    },

    transaction,
  });

  let billableIncidentQuantity = 0;
  let nonBillableIncidentQuantity = 0;
  let pendingReviewQuantity = 0;

  for (const incident of incidents) {
    const quantity = Number(incident.quantity || 0);

    if (incident.billing_resolution === "BILLABLE") {
      billableIncidentQuantity += quantity;
    } else if (incident.billing_resolution === "NON_BILLABLE") {
      nonBillableIncidentQuantity += quantity;
    } else {
      pendingReviewQuantity += quantity;
    }
  }

  return {
    closed_quantity: closedQuantity,

    billable_incident_quantity: billableIncidentQuantity,

    non_billable_incident_quantity: nonBillableIncidentQuantity,

    pending_review_quantity: pendingReviewQuantity,

    billable_quantity: closedQuantity + billableIncidentQuantity,

    billing_ready: pendingReviewQuantity === 0,

    incidents: incidents.map((incident) => ({
      id: incident.id,

      quantity: Number(incident.quantity),

      reason: incident.reason,

      description: incident.description,

      billing_resolution: incident.billing_resolution,
    })),
  };
}

/**
 * Determina si un lote completo está listo
 * para ser incluido en un borrador.
 */
async function getBatchBillingResolution(batch: any, transaction?: any) {
  const batchJson = typeof batch.toJSON === "function" ? batch.toJSON() : batch;

  const items = [] as any[];

  let pendingReviewQuantity = 0;
  let billableQuantity = 0;

  for (const batchItem of batchJson.items || []) {
    const resolution = await getBatchItemBillingResolution(
      batchJson.id,
      batchItem.garment_id,
      transaction,
    );

    pendingReviewQuantity += resolution.pending_review_quantity;

    billableQuantity += resolution.billable_quantity;

    items.push({
      batch_item_id: batchItem.id,

      garment_id: batchItem.garment_id,

      garment_code: batchItem.garment?.code || null,

      garment_description: batchItem.garment?.description || null,

      quantity_sent: Number(batchItem.quantity_sent || 0),

      quantity_processed: Number(batchItem.quantity_processed || 0),

      gross_unit_value: Number(batchItem.unit_value || 0),

      unit_value: getNetValueFromVatIncluded(Number(batchItem.unit_value || 0)),

      ...resolution,
    });
  }

  return {
    billing_ready: pendingReviewQuantity === 0,

    pending_review_quantity: pendingReviewQuantity,

    billable_quantity: billableQuantity,

    items,
  };
}

/**
 * Determina si un lote ya está asociado
 * a otra facturación no cancelada.
 */
async function findBlockingBillingBatch(
  batchId: string,
  transaction?: any,
  excludeBillingDocumentId?: string,
) {
  return BillingDocumentBatch.findOne({
    where: {
      batch_id: batchId,

      ...(excludeBillingDocumentId
        ? {
            billing_document_id: {
              [Op.ne]: excludeBillingDocumentId,
            },
          }
        : {}),
    },

    include: [
      {
        model: BillingDocument,

        as: "billing_document",

        required: true,

        where: {
          status: {
            [Op.in]: BLOCKING_BILLING_STATUSES,
          },
        },

        attributes: ["id", "status"],
      },
    ],

    transaction,
  });
}

/**
 * =========================================================
 * LOTES DISPONIBLES
 * =========================================================
 *
 * GET /billing/available-batches/:clientId
 *
 * Solo devuelve:
 *
 * - lotes del cliente
 * - estado CERRADO
 * - no comprometidos en otra facturación
 */
export async function getAvailableBillingBatches(req: Request, res: Response) {
  try {
    const clientId = req.params.clientId as string;

    const client = await Client.findByPk(clientId);

    if (!client) {
      return res.status(404).json({
        ok: false,
        message: "Cliente no encontrado",
      });
    }

    /**
     * Informamos si está listo tributariamente.
     */
    const missingFields = getMissingBillingFields(client);

    const closedStatus = await MovementStatus.findOne({
      where: {
        code: "CERRADO",
      },
    });

    if (!closedStatus) {
      return res.status(500).json({
        ok: false,
        message: "No existe el estado CERRADO",
      });
    }

    /**
     * Obtener lotes ya comprometidos.
     */
    const occupiedRecords = await BillingDocumentBatch.findAll({
      include: [
        {
          model: BillingDocument,

          as: "billing_document",

          required: true,

          where: {
            status: {
              [Op.in]: BLOCKING_BILLING_STATUSES,
            },
          },

          attributes: ["id"],
        },
      ],

      attributes: ["batch_id"],
    });

    const occupiedBatchIds = occupiedRecords.map((record) => record.batch_id);

    const batches = await GarmentBatch.findAll({
      where: {
        client_id: clientId,

        current_status_id: closedStatus.id,

        ...(occupiedBatchIds.length > 0
          ? {
              id: {
                [Op.notIn]: occupiedBatchIds,
              },
            }
          : {}),
      },

      include: [
        {
          model: MovementStatus,

          as: "current_status",

          attributes: ["id", "code", "name"],
        },

        {
          model: GarmentBatchItem,

          as: "items",

          include: [
            {
              model: Garment,

              as: "garment",

              attributes: ["id", "code", "description"],
            },
          ],
        },
      ],

      order: [
        ["closed_at", "DESC"],

        ["createdAt", "DESC"],
      ],
    });

    /**
     * Dejamos solo información útil
     * para la pantalla de selección.
     */
    const resolvedBatches = await Promise.all(
      batches.map(async (batch) => {
        const json = batch.toJSON() as any;

        const resolution = await getBatchBillingResolution(batch);

        const items = resolution.items
          .filter(
            (item: any) =>
              Number(item.billable_quantity || 0) > 0 ||
              Number(item.pending_review_quantity || 0) > 0,
          )
          .map((item: any) => {
            const { lineSubtotal } = calculateBillingLine(
              Number(item.billable_quantity || 0),
              Number(item.unit_value || 0),
              0,
            );

            return {
              ...item,

              quantity: Number(item.billable_quantity || 0),

              line_subtotal: lineSubtotal,
            };
          });

        const estimatedTotal = items.reduce(
          (sum: number, item: any) => sum + Number(item.line_subtotal || 0),
          0,
        );

        return {
          id: json.id,

          batch_number: json.batch_number,

          created_at: json.createdAt,

          closed_at: json.closed_at,

          status: json.current_status,

          item_count: items.length,

          estimated_net: estimatedTotal,

          billing_ready: resolution.billing_ready,

          pending_review_quantity: resolution.pending_review_quantity,

          billable_quantity: resolution.billable_quantity,

          items,
        };
      }),
    );

    const data = resolvedBatches.filter((batch) => batch.items.length > 0);

    return res.json({
      ok: true,

      client: {
        id: client.id,

        name: client.name,

        rut: client.rut,

        legal_name: client.legal_name,

        business_activity: client.business_activity,

        address: client.address,

        commune: client.commune,

        city: client.city,

        dte_email: client.dte_email,

        billing_ready: missingFields.length === 0,

        missing_fields: missingFields,
      },

      data,
    });
  } catch (error) {
    console.error("Error obteniendo lotes facturables:", error);

    return res.status(500).json({
      ok: false,
      message: "Error obteniendo lotes disponibles para facturación",
    });
  }
}

/**
 * =========================================================
 * CREAR BORRADOR
 * =========================================================
 *
 * POST /billing
 *
 * body:
 *
 * {
 *   client_id: "...",
 *   batch_ids: ["...", "..."],
 *   notes?: "..."
 * }
 */
export async function createBillingDraft(req: Request, res: Response) {
  const transaction = await sequelize.transaction();

  try {
    if (!req.user) {
      await transaction.rollback();

      return res.status(401).json({
        ok: false,
        message: "Usuario no autenticado",
      });
    }

    const { client_id, batch_ids, notes } = req.body;

    if (typeof client_id !== "string" || !client_id.trim()) {
      await transaction.rollback();

      return res.status(400).json({
        ok: false,
        message: "client_id es obligatorio",
      });
    }

    if (!Array.isArray(batch_ids) || batch_ids.length === 0) {
      await transaction.rollback();

      return res.status(400).json({
        ok: false,
        message: "Debe seleccionar al menos un lote",
      });
    }

    /**
     * Eliminar IDs repetidos.
     */
    const uniqueBatchIds = [
      ...new Set(
        batch_ids
          .filter((id: unknown) => typeof id === "string" && id.trim())
          .map((id: string) => id.trim()),
      ),
    ];

    if (uniqueBatchIds.length === 0) {
      await transaction.rollback();

      return res.status(400).json({
        ok: false,
        message: "No existen lotes válidos en la selección",
      });
    }

    const client = await Client.findByPk(client_id.trim(), {
      transaction,
    });

    if (!client) {
      await transaction.rollback();

      return res.status(404).json({
        ok: false,
        message: "Cliente no encontrado",
      });
    }

    /**
     * Para crear una facturación exigimos
     * información tributaria completa.
     */
    const missingFields = getMissingBillingFields(client);

    if (missingFields.length > 0) {
      await transaction.rollback();

      return res.status(400).json({
        ok: false,
        message: `Debe completar los antecedentes tributarios del cliente: ${missingFields.join(", ")}`,
      });
    }

    const closedStatus = await MovementStatus.findOne({
      where: {
        code: "CERRADO",
      },

      transaction,
    });

    if (!closedStatus) {
      await transaction.rollback();

      return res.status(500).json({
        ok: false,
        message: "No existe estado CERRADO",
      });
    }

    /**
     * Buscar todos los lotes seleccionados.
     */
    const batches = await GarmentBatch.findAll({
      where: {
        id: {
          [Op.in]: uniqueBatchIds,
        },

        client_id: client.id,

        current_status_id: closedStatus.id,
      },

      include: [
        {
          model: GarmentBatchItem,

          as: "items",

          include: [
            {
              model: Garment,

              as: "garment",

              attributes: ["id", "code", "description"],
            },
          ],
        },
      ],

      transaction,
    });

    if (batches.length !== uniqueBatchIds.length) {
      await transaction.rollback();

      return res.status(400).json({
        ok: false,
        message:
          "Uno o más lotes no pertenecen al cliente, no existen o no están cerrados",
      });
    }

    /**
     * Verificar que ningún lote esté ya
     * comprometido en otra facturación.
     */
    for (const batch of batches) {
      const blocking = await findBlockingBillingBatch(batch.id, transaction);

      if (blocking) {
        await transaction.rollback();

        return res.status(409).json({
          ok: false,
          message: `El lote ${batch.batch_number} ya está asociado a otra facturación`,
        });
      }
    }

    /**
     * Resolver cantidades comerciales antes de
     * fotografiar el borrador.
     *
     * Si existe una incidencia pendiente de revisión,
     * el lote todavía NO es facturable.
     */
    const billingResolutionByBatch = new Map<string, any>();

    for (const batch of batches) {
      const resolution = await getBatchBillingResolution(batch, transaction);

      if (!resolution.billing_ready) {
        await transaction.rollback();

        return res.status(409).json({
          ok: false,
          message: `El lote ${batch.batch_number} tiene ${resolution.pending_review_quantity} unidad(es) con incidencia pendiente de revisión comercial`,
        });
      }

      billingResolutionByBatch.set(batch.id, resolution);
    }

    /**
     * Crear cabecera.
     *
     * Fotografiamos antecedentes tributarios.
     */
    const document = await BillingDocument.create(
      {
        client_id: client.id,

        created_by: req.user.id,

        status: "draft",

        receiver_rut: client.rut!,

        receiver_legal_name: client.legal_name!,

        receiver_business_activity: client.business_activity!,

        receiver_address: client.address!,

        receiver_commune: client.commune!,

        receiver_city: client.city!,

        receiver_email: client.dte_email,

        subtotal: 0,

        discount_total: 0,

        net_amount: 0,

        tax_rate: TAX_RATE,

        tax_amount: 0,

        total_amount: 0,

        notes: typeof notes === "string" && notes.trim() ? notes.trim() : null,

        engine_document_id: null,

        engine_status: null,

        engine_error: null,

        confirmed_at: null,

        sent_to_engine_at: null,
      },
      {
        transaction,
      },
    );

    let createdItemCount = 0;

    /**
     * Crear relación con lotes
     * + fotografía de sus líneas.
     */
    for (const batch of batches) {
      await BillingDocumentBatch.create(
        {
          billing_document_id: document.id,

          batch_id: batch.id,
        },
        {
          transaction,
        },
      );

      const batchJson = batch.toJSON() as any;

      for (const batchItem of batchJson.items || []) {
        /**
         * Regla comercial final:
         *
         * FACTURABLE =
         * CERRADO normal
         * + incidencias BILLABLE.
         *
         * NON_BILLABLE no entra.
         * PENDING_REVIEW ya fue bloqueado arriba.
         */
        const batchResolution = billingResolutionByBatch.get(batch.id);

        const itemResolution = batchResolution?.items?.find(
          (item: any) => item.garment_id === batchItem.garment_id,
        );

        const quantity = Number(itemResolution?.billable_quantity || 0);

        if (quantity <= 0) {
          continue;
        }

        /**
         * batchItem.unit_value es precio TL con IVA incluido.
         *
         * BillingDocumentItem.unit_value fotografía el
         * valor NETO que será enviado al Motor.
         */
        const grossUnitValue = Number(batchItem.unit_value || 0);

        const unitValue = getNetValueFromVatIncluded(grossUnitValue);

        const { lineSubtotal, discountAmount, lineTotal } =
          calculateBillingLine(quantity, unitValue, 0);

        await BillingDocumentItem.create(
          {
            billing_document_id: document.id,

            batch_id: batch.id,

            garment_id: batchItem.garment_id,

            garment_code: batchItem.garment?.code || "SIN-CODIGO",

            garment_description:
              batchItem.garment?.description || "Servicio de procesamiento",

            quantity,

            unit_value: unitValue,

            line_subtotal: lineSubtotal,

            discount_percentage: 0,

            discount_amount: discountAmount,

            line_total: lineTotal,
          },
          {
            transaction,
          },
        );

        createdItemCount += 1;
      }
    }

    if (createdItemCount === 0) {
      await transaction.rollback();

      return res.status(400).json({
        ok: false,
        message:
          "Los lotes seleccionados no contienen prendas procesadas facturables",
      });
    }

    await recalculateBillingDocument(document.id, transaction);

    await transaction.commit();

    return res.status(201).json({
      ok: true,
      message: "Borrador de facturación creado correctamente",

      data: {
        id: document.id,
      },
    });
  } catch (error) {
    await transaction.rollback();

    console.error("Error creando facturación:", error);

    return res.status(500).json({
      ok: false,
      message: "Error creando borrador de facturación",
    });
  }
}

/**
 * =========================================================
 * RESOLVER INCIDENCIA PARA FACTURACIÓN
 * =========================================================
 *
 * PATCH /billing/incidents/:incidentId/resolution
 *
 * body:
 * {
 *   billing_resolution: "BILLABLE" | "NON_BILLABLE"
 * }
 */
export async function updateIncidentBillingResolution(
  req: Request,
  res: Response,
) {
  const transaction = await sequelize.transaction();

  try {
    const incidentId = req.params.incidentId as string;

    const { billing_resolution } = req.body;

    if (
      billing_resolution !== "BILLABLE" &&
      billing_resolution !== "NON_BILLABLE"
    ) {
      await transaction.rollback();

      return res.status(400).json({
        ok: false,
        message: "billing_resolution debe ser BILLABLE o NON_BILLABLE",
      });
    }

    const incident = await GarmentIncident.findByPk(incidentId, {
      transaction,

      lock: transaction.LOCK.UPDATE,
    });

    if (!incident) {
      await transaction.rollback();

      return res.status(404).json({
        ok: false,
        message: "Incidencia no encontrada",
      });
    }

    if (incident.resolution_status !== "RESOLVED") {
      await transaction.rollback();

      return res.status(400).json({
        ok: false,
        message: "La incidencia logística todavía no está resuelta",
      });
    }

    const blocking = await findBlockingBillingBatch(
      incident.batch_id,
      transaction,
    );

    if (blocking) {
      await transaction.rollback();

      return res.status(409).json({
        ok: false,
        message:
          "La incidencia ya pertenece a un lote comprometido en una facturación y no puede cambiarse",
      });
    }

    await incident.update(
      {
        billing_resolution,
      },
      {
        transaction,
      },
    );

    await transaction.commit();

    return res.json({
      ok: true,
      message:
        billing_resolution === "BILLABLE"
          ? "Incidencia marcada como facturable"
          : "Incidencia marcada como no facturable",

      data: {
        id: incident.id,

        batch_id: incident.batch_id,

        garment_id: incident.garment_id,

        quantity: Number(incident.quantity),

        billing_resolution: incident.billing_resolution,
      },
    });
  } catch (error) {
    await transaction.rollback();

    console.error("Error resolviendo incidencia comercial:", error);

    return res.status(500).json({
      ok: false,
      message: "Error resolviendo incidencia para facturación",
    });
  }
}

/**
 * =========================================================
 * DETALLE
 * =========================================================
 *
 * GET /billing/:id
 */
export async function getBillingDocumentById(req: Request, res: Response) {
  try {
    const id = req.params.id as string;

    const document = await BillingDocument.findByPk(id, {
      include: [
        {
          model: Client,

          as: "client",
        },

        {
          model: BillingDocumentBatch,

          as: "batches",

          include: [
            {
              model: GarmentBatch,

              as: "batch",

              attributes: ["id", "batch_number", "createdAt", "closed_at"],
            },
          ],
        },

        {
          model: BillingDocumentItem,

          as: "items",

          include: [
            {
              model: Garment,

              as: "garment",

              attributes: ["id", "code", "description"],
            },

            {
              model: GarmentBatch,

              as: "batch",

              attributes: ["id", "batch_number"],
            },
          ],
        },
      ],

      order: [
        [
          {
            model: BillingDocumentItem,

            as: "items",
          },

          "createdAt",
          "ASC",
        ],
      ],
    });

    if (!document) {
      return res.status(404).json({
        ok: false,
        message: "Facturación no encontrada",
      });
    }

    return res.json({
      ok: true,
      data: document,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      ok: false,
      message: "Error obteniendo facturación",
    });
  }
}

/**
 * =========================================================
 * ACTUALIZAR DESCUENTO
 * =========================================================
 *
 * PATCH /billing/:id/items/:itemId/discount
 *
 * body:
 *
 * {
 *   discount_percentage: 5
 * }
 */
export async function updateBillingItemDiscount(req: Request, res: Response) {
  const transaction = await sequelize.transaction();

  try {
    const billingDocumentId = req.params.id as string;

    const itemId = req.params.itemId as string;

    const { discount_percentage } = req.body;

    if (!isValidDiscount(discount_percentage)) {
      await transaction.rollback();

      return res.status(400).json({
        ok: false,
        message: "El descuento debe estar entre 0 y 100",
      });
    }

    const document = await BillingDocument.findByPk(billingDocumentId, {
      transaction,

      lock: transaction.LOCK.UPDATE,
    });

    if (!document) {
      await transaction.rollback();

      return res.status(404).json({
        ok: false,
        message: "Facturación no encontrada",
      });
    }

    if (document.status !== "draft") {
      await transaction.rollback();

      return res.status(400).json({
        ok: false,
        message:
          "Solo se pueden modificar descuentos en una facturación en borrador",
      });
    }

    const item = await BillingDocumentItem.findOne({
      where: {
        id: itemId,

        billing_document_id: billingDocumentId,
      },

      transaction,

      lock: transaction.LOCK.UPDATE,
    });

    if (!item) {
      await transaction.rollback();

      return res.status(404).json({
        ok: false,
        message: "Ítem de facturación no encontrado",
      });
    }

    const discountPercentage = Number(discount_percentage);

    const { lineSubtotal, discountAmount, lineTotal } = calculateBillingLine(
      Number(item.quantity),

      Number(item.unit_value),

      discountPercentage,
    );

    await item.update(
      {
        line_subtotal: lineSubtotal,

        discount_percentage: discountPercentage,

        discount_amount: discountAmount,

        line_total: lineTotal,
      },
      {
        transaction,
      },
    );

    const updatedDocument = await recalculateBillingDocument(
      billingDocumentId,
      transaction,
    );

    await transaction.commit();

    return res.json({
      ok: true,

      message: "Descuento actualizado correctamente",

      data: {
        item,
        totals: {
          subtotal: Number(updatedDocument.subtotal),

          discount_total: Number(updatedDocument.discount_total),

          net_amount: Number(updatedDocument.net_amount),

          tax_amount: Number(updatedDocument.tax_amount),

          total_amount: Number(updatedDocument.total_amount),
        },
      },
    });
  } catch (error) {
    await transaction.rollback();

    console.error(error);

    return res.status(500).json({
      ok: false,
      message: "Error actualizando descuento",
    });
  }
}

/**
 * =========================================================
 * CONFIRMAR FACTURACIÓN
 * =========================================================
 *
 * POST /billing/:id/confirm
 *
 * TODAVÍA NO ENVÍA AL MOTOR.
 */
export async function confirmBillingDocument(req: Request, res: Response) {
  const transaction = await sequelize.transaction();

  try {
    const id = req.params.id as string;

    const document = await BillingDocument.findByPk(id, {
      transaction,

      lock: transaction.LOCK.UPDATE,
    });

    if (!document) {
      await transaction.rollback();

      return res.status(404).json({
        ok: false,
        message: "Facturación no encontrada",
      });
    }

    if (document.status !== "draft") {
      await transaction.rollback();

      return res.status(400).json({
        ok: false,
        message: "La facturación ya no se encuentra en borrador",
      });
    }

    const items = await BillingDocumentItem.findAll({
      where: {
        billing_document_id: id,
      },

      transaction,
    });

    if (items.length === 0) {
      await transaction.rollback();

      return res.status(400).json({
        ok: false,
        message: "La facturación no contiene ítems",
      });
    }

    const batches = await BillingDocumentBatch.findAll({
      where: {
        billing_document_id: id,
      },

      transaction,
    });

    if (batches.length === 0) {
      await transaction.rollback();

      return res.status(400).json({
        ok: false,
        message: "La facturación no contiene lotes",
      });
    }

    /**
     * Última protección contra duplicidad.
     *
     * Aunque validamos al crear el borrador,
     * revisamos nuevamente al confirmar.
     */
    for (const billingBatch of batches) {
      const blocking = await findBlockingBillingBatch(
        billingBatch.batch_id,
        transaction,
        id,
      );

      if (blocking) {
        await transaction.rollback();

        return res.status(409).json({
          ok: false,
          message: `El lote ${billingBatch.batch_id} quedó asociado a otra facturación`,
        });
      }
    }

    const recalculated = await recalculateBillingDocument(id, transaction);

    if (Number(recalculated.net_amount) <= 0) {
      await transaction.rollback();

      return res.status(400).json({
        ok: false,
        message: "El monto neto de la facturación debe ser mayor a cero",
      });
    }

    await recalculated.update(
      {
        status: "confirmed",

        confirmed_at: new Date(),
      },
      {
        transaction,
      },
    );

    await transaction.commit();

    return res.json({
      ok: true,

      message: "Facturación confirmada correctamente",

      data: {
        id: recalculated.id,

        status: "confirmed",

        subtotal: Number(recalculated.subtotal),

        discount_total: Number(recalculated.discount_total),

        net_amount: Number(recalculated.net_amount),

        tax_amount: Number(recalculated.tax_amount),

        total_amount: Number(recalculated.total_amount),
      },
    });
  } catch (error) {
    await transaction.rollback();

    console.error(error);

    return res.status(500).json({
      ok: false,
      message: "Error confirmando facturación",
    });
  }
}

/**
 * =========================================================
 * CANCELAR BORRADOR
 * =========================================================
 *
 * PATCH /billing/:id/cancel
 *
 * Permite liberar los lotes.
 */
export async function cancelBillingDraft(req: Request, res: Response) {
  const transaction = await sequelize.transaction();

  try {
    const id = req.params.id as string;

    const document = await BillingDocument.findByPk(id, {
      transaction,

      lock: transaction.LOCK.UPDATE,
    });

    if (!document) {
      await transaction.rollback();

      return res.status(404).json({
        ok: false,
        message: "Facturación no encontrada",
      });
    }

    if (document.status !== "draft") {
      await transaction.rollback();

      return res.status(400).json({
        ok: false,
        message: "Solo se puede cancelar una facturación en borrador",
      });
    }

    await document.update(
      {
        status: "cancelled",
      },
      {
        transaction,
      },
    );

    await transaction.commit();

    return res.json({
      ok: true,
      message: "Borrador cancelado correctamente",
    });
  } catch (error) {
    await transaction.rollback();

    console.error(error);

    return res.status(500).json({
      ok: false,
      message: "Error cancelando facturación",
    });
  }
}

/**
 * =========================================================
 * LISTADO
 * =========================================================
 *
 * GET /billing
 *
 * filtros:
 *
 * ?client_id=
 * ?status=
 */
export async function getBillingDocuments(req: Request, res: Response) {
  try {
    const { client_id, status } = req.query;

    const where: any = {};

    if (typeof client_id === "string" && client_id.trim()) {
      where.client_id = client_id.trim();
    }

    if (typeof status === "string" && status.trim()) {
      where.status = status.trim();
    }

    const documents = await BillingDocument.findAll({
      where,

      include: [
        {
          model: Client,

          as: "client",

          attributes: ["id", "name", "rut", "legal_name"],
        },
      ],

      order: [["createdAt", "DESC"]],
    });

    return res.json({
      ok: true,
      data: documents,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      ok: false,
      message: "Error obteniendo facturaciones",
    });
  }
}

/**
 * =========================================================
 * ENVIAR FACTURACIÓN AL MOTOR
 * =========================================================
 *
 * POST /billing/:id/send-to-engine
 */
export async function sendBillingDocumentToEngine(req: Request, res: Response) {
  const id = req.params.id as string;

  let document: BillingDocument | null = null;

  try {
    document = await BillingDocument.findByPk(id, {
      include: [
        {
          model: BillingDocumentItem,

          as: "items",
        },
      ],
    });

    if (!document) {
      return res.status(404).json({
        ok: false,
        message: "Facturación no encontrada",
      });
    }

    /**
     * =================================================
     * VALIDAR ESTADO
     * =================================================
     *
     * confirmed:
     * primera ejecución.
     *
     * error:
     * permitimos reintento.
     */
    if (document.status !== "confirmed" && document.status !== "error") {
      return res.status(400).json({
        ok: false,

        message: `La facturación no puede enviarse al Motor desde el estado ${document.status}`,
      });
    }

    const items = (document as any).items as BillingDocumentItem[];

    if (!items || items.length === 0) {
      return res.status(400).json({
        ok: false,
        message: "La facturación no contiene ítems",
      });
    }

    /**
     * =================================================
     * ESTADO TL → PENDING ENGINE
     * =================================================
     */
    await document.update({
      status: "pending_engine",

      engine_status: "pending",

      engine_error: null,
    });

    let engineDocumentId = document.engine_document_id;

    /**
     * =================================================
     * CREAR DOCUMENTO EN MOTOR
     * =================================================
     *
     * Si ya existe engine_document_id,
     * significa que estamos reintentando
     * una factura que ya alcanzó el Motor.
     *
     * No la creamos nuevamente.
     */
    if (!engineDocumentId) {
      const payload: BillingEngineInvoicePayload = {
        externalId: document.id,

        /**
         * Factura Electrónica.
         *
         * En esta primera integración
         * TL emite DTE 33.
         */
        documentType: 33,

        receiver: {
          rut: document.receiver_rut,

          razonSocial: document.receiver_legal_name,

          giro: document.receiver_business_activity || undefined,

          address: document.receiver_address || undefined,

          comuna: document.receiver_commune || undefined,

          ciudad: document.receiver_city || undefined,
        },

        items: items.map((item) => ({
          description: item.garment_description,

          quantity: Number(item.quantity),

          unitPrice: Number(item.unit_value),

          discountPercentage: Number(item.discount_percentage || 0),
        })),
      };

      const engineDocument = await createEngineInvoice(payload);

      engineDocumentId = engineDocument.id;

      /**
       * Guardamos inmediatamente el ID.
       *
       * Si falla el /process después,
       * un reintento NO vuelve a crear
       * otra factura en Motor.
       */
      await document.update({
        engine_document_id: engineDocumentId,

        engine_status: engineDocument.status,

        status: "engine_processing",

        sent_to_engine_at: new Date(),

        engine_error: null,
      });
    } else {
      await document.update({
        status: "engine_processing",

        engine_error: null,
      });
    }

    /**
     * =================================================
     * PROCESAR MOTOR
     * =================================================
     */
    const engineResult = await processEngineInvoice(engineDocumentId);

    const engineStatus = engineResult.status;

    /**
     * =================================================
     * ESTADO FINAL TL
     * =================================================
     */
    let tlStatus = "engine_processing";

    if (engineStatus === "accepted") {
      tlStatus = "completed";
    } else if (engineStatus === "rejected" || engineStatus === "error") {
      tlStatus = "error";
    }

    await document.update({
      status: tlStatus,

      engine_status: engineStatus,

      engine_error:
        engineStatus === "accepted" ? null : engineResult.sii?.status || null,
    });

    return res.json({
      ok: true,

      message:
        engineStatus === "accepted"
          ? "Facturación procesada correctamente"
          : "Facturación enviada al Motor",

      data: {
        billing_document_id: document.id,

        status: tlStatus,

        engine: {
          document_id: engineResult.document_id,

          folio: engineResult.folio,

          status: engineResult.status,

          net_amount: engineResult.net_amount,

          tax_amount: engineResult.tax_amount,

          total_amount: engineResult.total_amount,

          sii: engineResult.sii,
        },
      },
    });
  } catch (error: any) {
    console.error("Error enviando facturación al Motor:", error);

    if (document) {
      try {
        await document.update({
          status: "error",

          engine_status: "error",

          engine_error: error?.message || "Error comunicando con Motor",
        });
      } catch (updateError) {
        console.error(
          "No fue posible actualizar estado de error:",
          updateError,
        );
      }
    }

    return res.status(500).json({
      ok: false,

      message: error?.message || "Error enviando facturación al Motor",
    });
  }
}

export async function getBillingPdf(req: Request, res: Response) {
  try {
    const id = req.params.id as string;

    const document = await BillingDocument.findByPk(id);

    if (!document) {
      return res.status(404).json({
        ok: false,
        message: "Facturación no encontrada",
      });
    }

    if (!document.engine_document_id) {
      return res.status(400).json({
        ok: false,
        message:
          "La facturación todavía no tiene documento asociado en el Motor",
      });
    }

    const engineUrl = process.env.BILLING_ENGINE_URL?.replace(/\/$/, "");

    const engineApiKey = process.env.BILLING_ENGINE_API_KEY;

    if (!engineUrl || !engineApiKey) {
      throw new Error("Configuración del Motor de facturación incompleta");
    }

    const engineResponse = await axios.get(
      `${engineUrl}/api/billing/documents/${document.engine_document_id}/pdf`,
      {
        headers: {
          "x-api-key": engineApiKey,
        },

        responseType: "arraybuffer",
      },
    );

    res.setHeader("Content-Type", "application/pdf");

    const disposition = engineResponse.headers["content-disposition"];

    res.setHeader(
      "Content-Disposition",
      typeof disposition === "string"
        ? disposition
        : `inline; filename="factura-${document.id}.pdf"`,
    );

    return res.send(Buffer.from(engineResponse.data));
  } catch (error: any) {
    console.error(
      "Error obteniendo PDF desde Motor:",
      error?.response?.data || error,
    );

    const status = Number(error?.response?.status) || 500;

    return res.status(status).json({
      ok: false,
      message: "No fue posible obtener el PDF de la factura",
    });
  }
}

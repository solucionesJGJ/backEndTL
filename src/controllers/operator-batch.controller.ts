import type { Request, Response } from "express";
import {
  Client,
  GarmentBatch,
  GarmentBatchItem,
  GarmentMovement,
  GarmentStock,
  MovementStatus,
  sequelize,
  User,
} from "../models/index.js";

import {
  createGarmentMovement,
  getBatchGarmentStatusBalance,
} from "../service/garment-movement.service.js";

import { Op } from "sequelize";
import { isNonEmptyString } from "../utils/validators.js";

function canRoleExecuteTransition(
  roleName: string | undefined,
  currentStatusCode: string,
  nextStatusCode: string,
) {
  /*
   * Administrador puede ejecutar
   * cualquier transición permitida.
   */

  if (roleName === "admin") {
    return true;
  }

  /*
   * Planta puede iniciar el traslado.
   */

  if (roleName === "warehouse_operator") {
    return (
      currentStatusCode === "EN_PROCESO" && nextStatusCode === "EN_TRASLADO"
    );
  }

  /*
   * Cliente confirma recepción
   * y cierra el lote.
   */

  if (roleName === "client_operator") {
    return currentStatusCode === "EN_TRASLADO" && nextStatusCode === "CERRADO";
  }

  return false;
}

const allowedTransitions: Record<string, string[]> = {
  EN_PROCESO: ["EN_TRASLADO"],
  EN_TRASLADO: ["CERRADO"],
};

function buildClientPrefix(clientName: string) {
  return clientName
    .split(/\s+/)
    .map((word) => word[0])
    .join("")
    .slice(0, 3)
    .toLowerCase();
}

async function generateBatchNumber(clientName: string) {
  const prefix = buildClientPrefix(clientName);

  const lastBatch = await GarmentBatch.findOne({
    where: {
      batch_number: {
        [Op.iLike]: `lote-${prefix}-%`,
      },
    },
    order: [["createdAt", "DESC"]],
  });

  let nextNumber = 1;

  if (lastBatch) {
    const parts = lastBatch.batch_number.split("-");
    const lastNumber = Number(parts[2]);

    if (!Number.isNaN(lastNumber)) {
      nextNumber = lastNumber + 1;
    }
  }

  return `lote-${prefix}-${String(nextNumber).padStart(3, "0")}`;
}

type ReceptionState = "ZERO" | "PARTIAL" | "COMPLETE";

type ReceptionSummary = {
  status: ReceptionState;
  total_sent: number;
  total_received: number;
  total_pending: number;
  percentage: number;
};

function buildReceptionSummary(items: GarmentBatchItem[]): ReceptionSummary {
  const totalSent = items.reduce(
    (total, item) => total + Number(item.quantity_sent || 0),
    0,
  );

  const totalReceived = items.reduce(
    (total, item) => total + Number(item.quantity_received || 0),
    0,
  );

  const totalPending = Math.max(totalSent - totalReceived, 0);

  let status: ReceptionState = "ZERO";

  if (totalSent > 0 && totalReceived >= totalSent) {
    status = "COMPLETE";
  } else if (totalReceived > 0) {
    status = "PARTIAL";
  }

  const percentage =
    totalSent > 0
      ? Math.min(Math.round((totalReceived / totalSent) * 100), 100)
      : 0;

  return {
    status,
    total_sent: totalSent,
    total_received: totalReceived,
    total_pending: totalPending,
    percentage,
  };
}

export async function getOperatorBatches(req: Request, res: Response) {
  try {
    const where: any = {};

    if (req.user?.role?.name === "client_operator") {
      where.client_id = req.user.client_id;
    }
    const batches = await GarmentBatch.findAll({
      where,
      include: [
        { model: Client, as: "client", attributes: ["id", "name", "rut"] },
        { model: User, as: "creator", attributes: ["id", "name", "email"] },
        {
          model: MovementStatus,
          as: "current_status",
          attributes: ["id", "code", "name"],
        },

        {
          model: GarmentBatchItem,
          as: "items",
          attributes: [
            "id",
            "garment_id",
            "quantity_sent",
            "quantity_received",
            "quantity_processed",
            "quantity_returned",
          ],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    const data = batches.map((batch) => {
      const json = batch.toJSON() as any;

      return {
        ...json,

        reception_summary: buildReceptionSummary(json.items || []),
      };
    });

    return res.json({
      ok: true,
      data: data,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      ok: false,
      message: "Error obteniendo lotes",
    });
  }
}

export async function getOperatorBatchById(req: Request, res: Response) {
  try {
    const id = req.params.id as string;

    const batch = await GarmentBatch.findByPk(id, {
      include: [
        { model: Client, as: "client", attributes: ["id", "name", "rut"] },
        { model: User, as: "creator", attributes: ["id", "name", "email"] },
        {
          model: MovementStatus,
          as: "current_status",
          attributes: ["id", "code", "name"],
        },
        {
          model: GarmentBatchItem,
          as: "items",
          attributes: [
            "id",
            "garment_id",
            "quantity_sent",
            "quantity_received",
            "quantity_processed",
            "quantity_returned",
          ],
        },
      ],
    });

    if (!batch) {
      return res.status(404).json({
        ok: false,
        message: "Lote no encontrado",
      });
    }

    const json = batch.toJSON() as any;

    return res.json({
      ok: true,

      data: {
        ...json,

        reception_summary: buildReceptionSummary(json.items || []),
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      ok: false,
      message: "Error obteniendo lote",
    });
  }
}

export async function createOperatorBatch(req: Request, res: Response) {
  try {
    const { client_id, notes } = req.body;

    const user = req.user;

    if (!user) {
      return res.status(401).json({
        ok: false,
        message: "Usuario no autenticado",
      });
    }

    const roleName = user.role?.name;

    let finalClientId: string | null = null;

    if (roleName === "client_operator") {
      if (!user.client_id) {
        return res.status(403).json({
          ok: false,
          message: "El operario cliente no tiene cliente asociado",
        });
      }

      finalClientId = user.client_id;
    }

    if (roleName === "admin") {
      if (typeof client_id !== "string" || !client_id.trim()) {
        return res.status(400).json({
          ok: false,
          message: "client_id es obligatorio para administrador",
        });
      }

      finalClientId = client_id.trim();
    }

    if (roleName !== "admin" && roleName !== "client_operator") {
      return res.status(403).json({
        ok: false,
        message: "No tienes permisos para crear lotes",
      });
    }

    const client = await Client.findByPk(finalClientId || "");

    if (!client) {
      return res.status(404).json({
        ok: false,
        message: "Cliente no encontrado",
      });
    }

    const initialStatus = await MovementStatus.findOne({
      where: {
        code: "BORRADOR_CLIENTE",
      },
    });

    if (!initialStatus) {
      return res.status(500).json({
        ok: false,
        message: "No existe estado inicial PENDIENTE_RECEPCION",
      });
    }

    const batchNumber = await generateBatchNumber(client.name);

    const batch = await GarmentBatch.create({
      client_id: finalClientId || "",
      batch_number: batchNumber,
      created_by: user.id,
      origin_location: "Cliente",
      destination_location: "Planta Central",
      current_status_id: initialStatus.id,
      received_at: null,
      notes: notes || null,
    });

    return res.status(201).json({
      ok: true,
      message: "Lote creado correctamente",
      data: batch,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      ok: false,
      message: "Error creando lote",
    });
  }
}

export async function receiveOperatorBatch(req: Request, res: Response) {
  const transaction = await sequelize.transaction();

  try {
    const id = req.params.id as string;

    const { notes } = req.body;

    const user = req.user;

    /*
     * =================================================
     * USUARIO
     * =================================================
     */

    if (!user) {
      await transaction.rollback();

      return res.status(401).json({
        ok: false,
        message: "Usuario no autenticado",
      });
    }

    const roleName = user.role?.name;

    if (roleName !== "admin" && roleName !== "warehouse_operator") {
      await transaction.rollback();

      return res.status(403).json({
        ok: false,
        message: "No tienes permisos para recepcionar lotes",
      });
    }

    /*
     * =================================================
     * LOTE
     * =================================================
     */

    const batch = await GarmentBatch.findByPk(id, {
      include: [
        {
          model: MovementStatus,

          as: "current_status",

          attributes: ["id", "code", "name"],
        },
      ],

      transaction,

      lock: transaction.LOCK.UPDATE,
    });

    if (!batch) {
      await transaction.rollback();

      return res.status(404).json({
        ok: false,
        message: "Lote no encontrado",
      });
    }

    const batchJson = batch.toJSON() as any;

    /*
     * =================================================
     * VALIDAR ESTADO
     * =================================================
     */

    if (batchJson.current_status?.code !== "PENDIENTE_RECEPCION") {
      await transaction.rollback();

      return res.status(400).json({
        ok: false,
        message: "Solo se pueden recepcionar lotes despachados a planta",
      });
    }

    /*
     * =================================================
     * ESTADO PROCESADO
     * =================================================
     *
     * Internamente mantenemos EN_PROCESO.
     * Visualmente lo llamaremos Procesado.
     */

    const processedStatus = await MovementStatus.findOne({
      where: {
        code: "EN_PROCESO",
      },

      transaction,
    });

    if (!processedStatus) {
      await transaction.rollback();

      return res.status(500).json({
        ok: false,
        message: "No existe estado EN_PROCESO",
      });
    }

    /*
     * =================================================
     * ITEMS
     * =================================================
     */

    const items = await GarmentBatchItem.findAll({
      where: {
        batch_id: id,
      },

      transaction,

      lock: transaction.LOCK.UPDATE,
    });

    if (items.length === 0) {
      await transaction.rollback();

      return res.status(400).json({
        ok: false,
        message: "El lote no contiene prendas",
      });
    }

    /*
     * =================================================
     * RECEPCIONAR TODAS LAS PRENDAS
     * =================================================
     *
     * Solamente movemos la cantidad que todavía
     * falta por recepcionar.
     *
     * Esto hace que el método sea compatible con
     * recepciones individuales realizadas antes.
     */

    for (const item of items) {
      const quantitySent = Number(item.quantity_sent || 0);

      const quantityReceived = Number(item.quantity_received || 0);

      const pendingQuantity = quantitySent - quantityReceived;

      /*
       * Si esta prenda ya fue completamente
       * recepcionada individualmente,
       * no hacemos nada.
       */

      if (pendingQuantity <= 0) {
        continue;
      }

      await createGarmentMovement(
        {
          batch_id: id,

          garment_id: item.garment_id,

          from_status_id: batchJson.current_status.id,

          to_status_id: processedStatus.id,

          quantity: pendingQuantity,

          movement_type: "recepcion_planta",

          created_by: user.id,

          notes: notes || "Recepción de lote en planta",
        },

        transaction,
      );
    }

    /*
     * =================================================
     * VERIFICAR RECEPCIÓN COMPLETA
     * =================================================
     */

    const updatedItems = await GarmentBatchItem.findAll({
      where: {
        batch_id: id,
      },

      transaction,
    });

    const fullyReceived = updatedItems.every((item) => {
      return (
        Number(item.quantity_received || 0) >= Number(item.quantity_sent || 0)
      );
    });

    if (!fullyReceived) {
      throw new Error(
        "No fue posible completar la recepción de todas las prendas del lote",
      );
    }

    /*
     * =================================================
     * ACTUALIZAR LOTE
     * =================================================
     */

    await batch.update(
      {
        current_status_id: processedStatus.id,

        received_at: new Date(),

        notes: [
          batch.notes,

          "Recepción completa en planta",

          notes ? `Recepción: ${notes}` : null,
        ]
          .filter(Boolean)
          .join("\n"),
      },
      {
        transaction,
      },
    );

    /*
     * =================================================
     * COMMIT
     * =================================================
     */

    await transaction.commit();

    return res.json({
      ok: true,

      message: "Lote recepcionado y procesado correctamente",

      data: batch,
    });
  } catch (error) {
    await transaction.rollback();

    console.error(error);

    return res.status(500).json({
      ok: false,

      message:
        error instanceof Error ? error.message : "Error recepcionando lote",
    });
  }
}

export async function evaluateOperatorBatch(req: Request, res: Response) {
  const transaction = await sequelize.transaction();

  try {
    const id = req.params.id as string;
    const { can_process, notes } = req.body;

    if (typeof can_process !== "boolean") {
      await transaction.rollback();
      return res.status(400).json({
        ok: false,
        message: "can_process debe ser boolean",
      });
    }

    const batch = await GarmentBatch.findByPk(id, {
      include: [
        {
          model: MovementStatus,
          as: "current_status",
          attributes: ["id", "code", "name"],
        },
      ],
      transaction,
    });

    if (!batch) {
      await transaction.rollback();
      return res.status(404).json({
        ok: false,
        message: "Lote no encontrado",
      });
    }

    const batchJson = batch.toJSON() as any;

    if (batchJson.current_status?.code !== "RECEPCIONADO") {
      await transaction.rollback();
      return res.status(400).json({
        ok: false,
        message: "Solo se pueden evaluar lotes en estado Recepcionado",
      });
    }

    const nextStatusCode = can_process ? "EN_PROCESO" : "DERIVADO_EXTERNO";

    const nextStatus = await MovementStatus.findOne({
      where: {
        code: nextStatusCode,
      },
      transaction,
    });

    if (!nextStatus) {
      await transaction.rollback();
      return res.status(500).json({
        ok: false,
        message: `No existe estado ${nextStatusCode}`,
      });
    }

    const evaluationNote = can_process
      ? "Evaluación: lote enviado a proceso interno"
      : "Evaluación: lote derivado a proceso externo";

    await batch.update(
      {
        current_status_id: nextStatus.id,
        notes: [
          batch.notes,
          evaluationNote,
          notes ? `Observación: ${notes}` : null,
        ]
          .filter(Boolean)
          .join("\n"),
      },
      { transaction },
    );

    await transaction.commit();

    return res.json({
      ok: true,
      message: can_process
        ? "Lote enviado a proceso correctamente"
        : "Lote derivado externamente correctamente",
      data: batch,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      ok: false,
      message: "Error evaluando lote",
    });
  }
}

export async function changeOperatorBatchStatus(req: Request, res: Response) {
  const transaction = await sequelize.transaction();

  try {
    const id = req.params.id as string;

    const { next_status_code, notes, client_accepted, client_observation } =
      req.body;

    const user = req.user;

    /*
     * =================================================
     * USUARIO
     * =================================================
     */

    if (!user) {
      await transaction.rollback();

      return res.status(401).json({
        ok: false,
        message: "Usuario no autenticado",
      });
    }

    /*
     * =================================================
     * ESTADO DESTINO
     * =================================================
     */

    if (!isNonEmptyString(next_status_code)) {
      await transaction.rollback();

      return res.status(400).json({
        ok: false,
        message: "next_status_code es obligatorio",
      });
    }

    const nextStatusCode = next_status_code.trim().toUpperCase();

    /*
     * =================================================
     * LOTE
     * =================================================
     */

    const batch = await GarmentBatch.findByPk(id, {
      include: [
        {
          model: MovementStatus,

          as: "current_status",

          attributes: ["id", "code", "name"],
        },
      ],

      transaction,

      lock: transaction.LOCK.UPDATE,
    });

    if (!batch) {
      await transaction.rollback();

      return res.status(404).json({
        ok: false,
        message: "Lote no encontrado",
      });
    }

    const batchJson = batch.toJSON() as any;

    const currentStatus = batchJson.current_status;

    const currentCode = currentStatus?.code;

    if (!currentCode) {
      await transaction.rollback();

      return res.status(500).json({
        ok: false,
        message: "El lote no tiene un estado actual válido",
      });
    }

    /*
     * =================================================
     * VALIDAR TRANSICIÓN
     * =================================================
     */

    const allowedNextStatuses = allowedTransitions[currentCode] || [];

    if (!allowedNextStatuses.includes(nextStatusCode)) {
      await transaction.rollback();

      return res.status(400).json({
        ok: false,

        message: `No se permite cambiar de ${currentCode} a ${nextStatusCode}`,
      });
    }

    /*
     * =================================================
     * SEGURIDAD CLIENTE
     * =================================================
     */

    const roleName = user.role?.name;

    if (roleName === "client_operator" && batch.client_id !== user.client_id) {
      await transaction.rollback();

      return res.status(403).json({
        ok: false,

        message: "No puedes cerrar lotes de otro cliente",
      });
    }

    /*
     * =================================================
     * PERMISOS
     * =================================================
     */

    if (!canRoleExecuteTransition(roleName, currentCode, nextStatusCode)) {
      await transaction.rollback();

      return res.status(403).json({
        ok: false,

        message: "No tienes permisos para realizar esta transición",
      });
    }

    /*
     * =================================================
     * ESTADO DESTINO
     * =================================================
     */

    const nextStatus = await MovementStatus.findOne({
      where: {
        code: nextStatusCode,
      },

      transaction,
    });

    if (!nextStatus) {
      await transaction.rollback();

      return res.status(404).json({
        ok: false,

        message: "Estado destino no encontrado",
      });
    }

    /*
     * =================================================
     * ITEMS DEL LOTE
     * =================================================
     */

    const items = await GarmentBatchItem.findAll({
      where: {
        batch_id: id,
      },

      transaction,

      lock: transaction.LOCK.UPDATE,
    });

    if (items.length === 0) {
      await transaction.rollback();

      return res.status(400).json({
        ok: false,

        message: "El lote no contiene prendas",
      });
    }

    /*
     * =================================================
     * MOVER PRENDAS
     * =================================================
     *
     * Para cada prenda utilizamos el stock REAL
     * disponible en el estado actual.
     *
     * No utilizamos quantity_sent a ciegas:
     * eso permitiría mover unidades que todavía
     * no hayan llegado al estado origen.
     *
     * =================================================
     */

    for (const item of items) {
      /* const originStock =
                await GarmentStock.findOne({
                    where: {
                        client_id:
                            batch.client_id,

                        garment_id:
                            item.garment_id,

                        status_id:
                            currentStatus.id,
                    },

                    transaction,

                    lock:
                        transaction.LOCK.UPDATE,
                });


            const availableQuantity =
                Number(
                    originStock?.quantity
                    || 0,
                ); */
      const availableQuantity = await getBatchGarmentStatusBalance(
        id,
        item.garment_id,
        currentStatus.id,
        transaction,
      );

      /*
       * Si una prenda no tiene stock en este
       * estado, no fabricamos un movimiento.
       */

      if (availableQuantity <= 0) {
        continue;
      }

      let movementType = "cambio_estado_lote";

      if (currentCode === "EN_PROCESO" && nextStatusCode === "EN_TRASLADO") {
        movementType = "inicio_traslado";
      }

      if (currentCode === "EN_TRASLADO" && nextStatusCode === "CERRADO") {
        movementType = "cierre_cliente";
      }

      await createGarmentMovement(
        {
          batch_id: id,

          garment_id: item.garment_id,

          from_status_id: currentStatus.id,

          to_status_id: nextStatus.id,

          quantity: availableQuantity,

          movement_type: movementType,

          created_by: user.id,

          notes: notes || null,
        },

        transaction,
      );
    }

    /*
     * =================================================
     * VERIFICAR BALANCE DEL LOTE
     * =================================================
     */

    for (const item of items) {
      const remainingQuantity = await getBatchGarmentStatusBalance(
        id,
        item.garment_id,
        currentStatus.id,
        transaction,
      );

      if (remainingQuantity > 0) {
        throw new Error(
          `La prenda ${item.garment_id} aún mantiene ${remainingQuantity} unidades en el estado anterior`,
        );
      }
    }

    /*
     * =================================================
     * CONFORMIDAD CLIENTE
     * =================================================
     */

    const clientAcceptedNote =
      typeof client_accepted === "boolean"
        ? `Conformidad cliente: ${client_accepted ? "aceptada" : "rechazada"}`
        : null;

    const clientObservationNote = isNonEmptyString(client_observation)
      ? `Observación cliente: ${client_observation.trim()}`
      : null;

    const statusNote = `Cambio de estado: ${currentCode} → ${nextStatusCode}`;

    /*
     * =================================================
     * ACTUALIZAR LOTE
     * =================================================
     */

    await batch.update(
      {
        current_status_id: nextStatus.id,

        closed_at: nextStatusCode === "CERRADO" ? new Date() : batch.closed_at,

        notes: [
          batch.notes,

          statusNote,

          notes ? `Observación: ${notes}` : null,

          clientAcceptedNote,

          clientObservationNote,
        ]
          .filter(Boolean)
          .join("\n"),
      },
      {
        transaction,
      },
    );

    /*
     * =================================================
     * COMMIT
     * =================================================
     */

    await transaction.commit();

    return res.json({
      ok: true,

      message:
        nextStatusCode === "CERRADO"
          ? "Lote cerrado correctamente"
          : "Estado del lote actualizado correctamente",

      data: batch,
    });
  } catch (error) {
    await transaction.rollback();

    console.error(error);

    return res.status(500).json({
      ok: false,

      message:
        error instanceof Error
          ? error.message
          : "Error actualizando estado del lote",
    });
  }
}

export async function dispatchClientBatch(req: Request, res: Response) {
  const transaction = await sequelize.transaction();

  try {
    const id = req.params.id as string;
    const user = req.user;

    if (!user) {
      await transaction.rollback();
      return res.status(401).json({
        ok: false,
        message: "Usuario no autenticado",
      });
    }

    const batch = await GarmentBatch.findByPk(id, {
      include: [
        {
          model: MovementStatus,
          as: "current_status",
          attributes: ["id", "code", "name"],
        },
      ],
      transaction,
    });

    if (!batch) {
      await transaction.rollback();
      return res.status(404).json({
        ok: false,
        message: "Lote no encontrado",
      });
    }

    const batchJson = batch.toJSON() as any;

    if (
      user?.role?.name === "client_operator" &&
      batch.client_id !== user.client_id
    ) {
      await transaction.rollback();
      return res.status(403).json({
        ok: false,
        message: "No puedes despachar lotes de otro cliente",
      });
    }

    if (batchJson.current_status?.code !== "BORRADOR_CLIENTE") {
      await transaction.rollback();
      return res.status(400).json({
        ok: false,
        message: "Solo se pueden despachar lotes en borrador",
      });
    }

    const draftStatus = await MovementStatus.findOne({
      where: { code: "BORRADOR_CLIENTE" },
      transaction,
    });

    const pendingStatus = await MovementStatus.findOne({
      where: { code: "PENDIENTE_RECEPCION" },
      transaction,
    });

    if (!draftStatus || !pendingStatus) {
      await transaction.rollback();
      return res.status(500).json({
        ok: false,
        message: "No existen estados BORRADOR_CLIENTE o PENDIENTE_RECEPCION",
      });
    }

    const items = await GarmentBatchItem.findAll({
      where: { batch_id: id },
      transaction,
    });

    if (items.length === 0) {
      await transaction.rollback();
      return res.status(400).json({
        ok: false,
        message: "No se puede despachar un lote sin prendas",
      });
    }

    for (const item of items) {
      const quantity = Number(item.quantity_sent || 0);

      const originStock = await GarmentStock.findOne({
        where: {
          client_id: batch.client_id,
          garment_id: item.garment_id,
          status_id: draftStatus.id,
        },
        transaction,
      });

      if (!originStock || Number(originStock.quantity) < quantity) {
        await transaction.rollback();
        return res.status(400).json({
          ok: false,
          message: `Stock insuficiente en borrador para la prenda ${item.garment_id}`,
        });
      }

      await originStock.update(
        {
          quantity: Number(originStock.quantity) - quantity,
        },
        { transaction },
      );

      const [destinationStock, createdDestinationStock] =
        await GarmentStock.findOrCreate({
          where: {
            client_id: batch.client_id,
            garment_id: item.garment_id,
            status_id: pendingStatus.id,
          },
          defaults: {
            client_id: batch.client_id,
            garment_id: item.garment_id,
            status_id: pendingStatus.id,
            quantity,
          },
          transaction,
        });

      if (!createdDestinationStock) {
        await destinationStock.update(
          {
            quantity: Number(destinationStock.quantity || 0) + quantity,
          },
          { transaction },
        );
      }

      await GarmentMovement.create(
        {
          batch_id: id,
          garment_id: item.garment_id,
          from_status_id: draftStatus.id,
          to_status_id: pendingStatus.id,
          quantity,
          movement_type: "despacho_cliente",
          created_by: user.id,
          notes: "Despacho automático desde cliente a planta",
        },
        { transaction },
      );
    }

    await batch.update(
      {
        current_status_id: pendingStatus.id,
        notes: [batch.notes, "Despachado desde cliente"]
          .filter(Boolean)
          .join("\n"),
      },
      { transaction },
    );

    await transaction.commit();

    return res.json({
      ok: true,
      message: "Lote despachado a planta correctamente",
      data: batch,
    });
  } catch (error) {
    await transaction.rollback();
    console.error(error);

    return res.status(500).json({
      ok: false,
      message: "Error despachando lote",
    });
  }
}

export async function previewOperatorBatchNumber(req: Request, res: Response) {
  try {
    const { client_id } = req.query;
    const user = req.user;

    if (!user) {
      return res.status(401).json({
        ok: false,
        message: "Usuario no autenticado",
      });
    }

    const roleName = user.role?.name;

    let finalClientId: string | null = null;

    if (roleName === "client_operator") {
      finalClientId = user.client_id;
    }

    if (roleName === "admin") {
      finalClientId = typeof client_id === "string" ? client_id.trim() : null;
    }

    if (!finalClientId) {
      return res.status(400).json({
        ok: false,
        message: "client_id es obligatorio",
      });
    }

    const client = await Client.findByPk(finalClientId);

    if (!client) {
      return res.status(404).json({
        ok: false,
        message: "Cliente no encontrado",
      });
    }

    const batchNumber = await generateBatchNumber(client.name);

    return res.json({
      ok: true,
      data: {
        batch_number: batchNumber,
        origin_location: "Cliente",
        destination_location: "Planta",
      },
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      ok: false,
      message: "Error generando número de lote",
    });
  }
}

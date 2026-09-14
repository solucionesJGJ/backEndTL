import type { Transaction } from "sequelize";

import {
  Client,
  DispatchGuide,
  DispatchGuideItem,
  DriverShift,
  Garment,
  GarmentBatch,
  GarmentMovement,
  MovementStatus,
  User,
  Vehicle,
  sequelize,
} from "../models/index.js";

import {
  createEngineInvoice,
  processEngineInvoice,
  type BillingEngineInvoicePayload,
} from "./billing-engine.service.js";

/**
 * =========================================================
 * TIPOS
 * =========================================================
 */

export type DispatchGuideLogisticsInput = {
  batch_id: string;

  driver_shift_id?: string | null;
  driver_user_id?: string | null;
  vehicle_id?: string | null;

  transfer_indicator?: number;
  dispatch_type?: number;

  departure_date?: string;
  departure_time?: string;
  arrival_date?: string;

  requested_by: string;
};

export type CreateDispatchGuideSnapshotInput = DispatchGuideLogisticsInput & {
  transaction: Transaction;
};

/**
 * =========================================================
 * CONSTANTES
 * =========================================================
 */

const DEFAULT_TRANSFER_INDICATOR = 5;

const DEFAULT_DISPATCH_TYPE = 1;

/**
 * =========================================================
 * FECHAS
 * =========================================================
 */

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function formatLocalDate(date: Date) {
  return [
    date.getFullYear(),
    pad2(date.getMonth() + 1),
    pad2(date.getDate()),
  ].join("-");
}

function formatLocalTime(date: Date) {
  return [pad2(date.getHours()), pad2(date.getMinutes())].join(":");
}

/**
 * =========================================================
 * TEXTO
 * =========================================================
 */

function requiredText(value: unknown, message: string) {
  const text = String(value ?? "").trim();

  if (!text) {
    throw new Error(message);
  }

  return text;
}

/**
 * =========================================================
 * INCLUDE
 * =========================================================
 */

function dispatchGuideInclude() {
  return [
    {
      model: GarmentBatch,

      as: "batch",
    },

    {
      model: Client,

      as: "client",
    },

    {
      model: DriverShift,

      as: "driver_shift",
    },

    {
      model: User,

      as: "assigned_driver",

      attributes: {
        exclude: ["password_hash"],
      },
    },

    {
      model: Vehicle,

      as: "vehicle",
    },

    {
      model: User,

      as: "requester",

      attributes: {
        exclude: ["password_hash"],
      },
    },

    {
      model: DispatchGuideItem,

      as: "items",

      include: [
        {
          model: Garment,

          as: "garment",
        },

        {
          model: GarmentMovement,

          as: "movement",

          required: false,
        },
      ],
    },
  ];
}

/**
 * =========================================================
 * OBTENER GUÍA
 * =========================================================
 */

export async function getDispatchGuideById(id: string) {
  const guide = await DispatchGuide.findByPk(id, {
    include: dispatchGuideInclude(),
  });

  if (!guide) {
    throw new Error("Guía de despacho no encontrada");
  }

  return guide;
}

/**
 * =========================================================
 * GUÍA POR LOTE
 * =========================================================
 */

export async function getDispatchGuideByBatch(batchId: string) {
  return DispatchGuide.findOne({
    where: {
      batch_id: batchId,
    },

    include: dispatchGuideInclude(),
  });
}

/**
 * =========================================================
 * LISTAR
 * =========================================================
 */

export async function listDispatchGuides() {
  return DispatchGuide.findAll({
    include: dispatchGuideInclude(),

    order: [["createdAt", "DESC"]],
  });
}

/**
 * =========================================================
 * RESOLVER JORNADA
 * =========================================================
 */

async function resolveDriverShift(
  input: DispatchGuideLogisticsInput,
  transaction?: Transaction,
) {
  if (input.driver_shift_id) {
    const shift = await DriverShift.findByPk(input.driver_shift_id, {
      include: [
        {
          model: User,

          as: "driver",
        },

        {
          model: Vehicle,

          as: "vehicle",
        },
      ],

      transaction,
    });

    if (!shift) {
      throw new Error("La jornada seleccionada no existe");
    }

    const shiftJson = shift.toJSON() as any;

    if (shiftJson.status !== "started") {
      throw new Error("La jornada seleccionada no se encuentra activa");
    }

    return shift;
  }

  const where: Record<string, unknown> = {
    status: "started",
  };

  if (input.driver_user_id) {
    where.user_id = input.driver_user_id;
  }

  if (input.vehicle_id) {
    where.vehicle_id = input.vehicle_id;
  }

  if (!input.driver_user_id && !input.vehicle_id) {
    throw new Error("Debe seleccionar una jornada, un conductor o un vehículo");
  }

  const shift = await DriverShift.findOne({
    where,

    include: [
      {
        model: User,

        as: "driver",
      },

      {
        model: Vehicle,

        as: "vehicle",
      },
    ],

    order: [["createdAt", "DESC"]],

    transaction,
  });

  if (!shift) {
    throw new Error(
      "No se encontró una jornada activa para el conductor o vehículo seleccionado",
    );
  }

  return shift;
}

/**
 * =========================================================
 * PRENDAS EN PROCESO
 * =========================================================
 *
 * FLUJO DEFINITIVO:
 *
 * EN_PROCESO -> EN_TRASLADO
 *
 * No utilizamos PREPARADO_DESPACHO.
 * =========================================================
 */

async function buildProcessedLines(batchId: string, transaction?: Transaction) {
  const processStatus = await MovementStatus.findOne({
    where: {
      code: "EN_PROCESO",
    },

    transaction,
  });

  if (!processStatus) {
    throw new Error("No existe el estado EN_PROCESO");
  }

  const movements = await GarmentMovement.findAll({
    where: {
      batch_id: batchId,
    },

    include: [
      {
        model: Garment,

        as: "garment",
      },
    ],

    order: [["createdAt", "ASC"]],

    transaction,
  });

  const balanceByGarment = new Map<
    string,
    {
      quantity: number;
      garment: any;
    }
  >();

  for (const movement of movements) {
    const movementJson = movement.toJSON() as any;

    const garment = movementJson.garment;

    if (!garment) {
      continue;
    }

    const quantity = Number(movement.quantity || 0);

    if (!Number.isFinite(quantity) || quantity <= 0) {
      continue;
    }

    const current = balanceByGarment.get(movement.garment_id) || {
      quantity: 0,

      garment,
    };

    if (movement.to_status_id === processStatus.id) {
      current.quantity += quantity;
    }

    if (movement.from_status_id === processStatus.id) {
      current.quantity -= quantity;
    }

    current.garment = garment;

    balanceByGarment.set(movement.garment_id, current);
  }

  const lines = Array.from(balanceByGarment.entries())
    .filter(([, value]) => value.quantity > 0)
    .map(([garmentId, value]) => {
      const garment = value.garment;

      const description = requiredText(
        garment.description || garment.size || garment.code,
        "Una prenda en proceso no tiene descripción",
      );

      const unitValue = Number(garment.value || 0);

      return {
        garment_id: garmentId,

        garment_code: String(garment.code || "").trim() || null,

        garment_description: description,

        quantity: value.quantity,

        unit_value: Number.isFinite(unitValue) ? unitValue : 0,
      };
    });

  if (lines.length === 0) {
    throw new Error("El lote no tiene prendas disponibles en EN_PROCESO");
  }

  return lines;
}

/**
 * =========================================================
 * CREAR SNAPSHOT TL
 * =========================================================
 *
 * NO LLAMA AL MOTOR.
 *
 * Esto permite crear:
 *
 * DispatchGuide
 * DispatchGuideItem[]
 * movimientos EN_PROCESO -> EN_TRASLADO
 *
 * dentro de una misma transacción.
 * =========================================================
 */

export async function createDispatchGuideSnapshot(
  input: CreateDispatchGuideSnapshotInput,
) {
  const { transaction } = input;

  const existing = await DispatchGuide.findOne({
    where: {
      batch_id: input.batch_id,
    },

    transaction,
  });

  if (existing) {
    return existing;
  }

  /**
   * =========================================================
   * LOTE
   * =========================================================
   *
   * IMPORTANTE:
   *
   * Bloqueamos solamente garment_batches.
   *
   * No debemos combinar:
   *
   * LEFT OUTER JOIN
   * +
   * FOR UPDATE
   *
   * porque PostgreSQL no permite aplicar FOR UPDATE
   * sobre el lado nullable de un outer join.
   * =========================================================
   */

  const batch = await GarmentBatch.findByPk(input.batch_id, {
    transaction,

    lock: transaction.LOCK.UPDATE,
  });

  if (!batch) {
    throw new Error("Lote no encontrado");
  }

  /**
   * =========================================================
   * CLIENTE
   * =========================================================
   *
   * Lo cargamos en una consulta independiente dentro
   * de la misma transacción.
   *
   * No necesitamos bloquear clients para realizar
   * el despacho.
   * =========================================================
   */

  const client = await Client.findByPk(batch.client_id, {
    transaction,
  });

  if (!client) {
    throw new Error("El lote no tiene cliente asociado");
  }

  const receiverRut = requiredText(
    client.rut,
    "El cliente no tiene RUT configurado",
  );

  const receiverName = requiredText(
    client.legal_name || client.name,
    "El cliente no tiene razón social configurada",
  );

  const receiverActivity = String(client.business_activity || "").trim();

  const destinationAddress = requiredText(
    client.address,
    "El cliente no tiene dirección configurada",
  );

  const destinationCommune = requiredText(
    client.commune,
    "El cliente no tiene comuna configurada",
  );

  const destinationCity = String(client.city || "").trim();

  const shift = await resolveDriverShift(input, transaction);

  const shiftJson = shift.toJSON() as any;

  const driver = shiftJson.driver as any;

  const vehicle = shiftJson.vehicle as any;

  if (!driver) {
    throw new Error("La jornada no tiene conductor asociado");
  }

  if (!vehicle) {
    throw new Error("La jornada no tiene vehículo asociado");
  }

  const driverRut = requiredText(
    driver.rut,
    "El conductor no tiene RUT configurado",
  );

  const driverName = requiredText(
    driver.name,
    "El conductor no tiene nombre configurado",
  );

  const vehiclePlate = requiredText(
    vehicle.plate,
    "El vehículo no tiene patente configurada",
  );

  const lines = await buildProcessedLines(batch.id, transaction);

  const now = new Date();

  const departureDate = input.departure_date || formatLocalDate(now);

  const departureTime = input.departure_time || formatLocalTime(now);

  const arrivalDate = input.arrival_date || departureDate;

  const guide = await DispatchGuide.create(
    {
      batch_id: batch.id,

      client_id: batch.client_id,

      driver_shift_id: shift.id,

      driver_user_id: shiftJson.user_id || driver.id,

      vehicle_id: shiftJson.vehicle_id || vehicle.id,

      receiver_rut: receiverRut,

      receiver_name: receiverName,

      receiver_activity: receiverActivity || null,

      driver_rut: driverRut,

      driver_name: driverName,

      vehicle_plate: vehiclePlate,

      carrier_rut: null,

      destination_address: destinationAddress,

      destination_commune: destinationCommune,

      destination_city: destinationCity || null,

      transfer_indicator:
        input.transfer_indicator ?? DEFAULT_TRANSFER_INDICATOR,

      dispatch_type: input.dispatch_type ?? DEFAULT_DISPATCH_TYPE,

      departure_date: departureDate,

      departure_time: departureTime,

      arrival_date: arrivalDate,

      engine_document_id: null,

      engine_status: null,

      engine_folio: null,

      engine_track_id: null,

      engine_error: null,

      status: "pending",

      requested_by: input.requested_by,

      requested_at: now,

      processed_at: null,
    },
    {
      transaction,
    },
  );

  await DispatchGuideItem.bulkCreate(
    lines.map((line) => ({
      dispatch_guide_id: guide.id,

      movement_id: null,

      garment_id: line.garment_id,

      garment_code: line.garment_code,

      garment_description: line.garment_description,

      quantity: line.quantity,

      unit_value: line.unit_value,
    })),
    {
      transaction,
    },
  );

  return guide;
}

/**
 * =========================================================
 * PAYLOAD MOTOR
 * =========================================================
 */

async function buildEnginePayload(guide: DispatchGuide) {
  const completeGuide = await getDispatchGuideById(guide.id);

  const guideJson = completeGuide.toJSON() as any;

  const items = Array.isArray(guideJson.items) ? guideJson.items : [];

  if (items.length === 0) {
    throw new Error("La guía no tiene prendas asociadas");
  }

  const payload: BillingEngineInvoicePayload = {
    externalId: `dispatch-guide:${guide.id}`,

    documentType: 52,

    receiver: {
      rut: guide.receiver_rut,

      razonSocial: guide.receiver_name,

      giro: guide.receiver_activity || undefined,

      address: guide.destination_address,

      comuna: guide.destination_commune,

      ciudad: guide.destination_city || undefined,
    },

    dispatch: {
      transferIndicator: guide.transfer_indicator,

      dispatchType: guide.dispatch_type ?? undefined,

      driverRut: requiredText(
        guide.driver_rut,
        "La guía no tiene RUT del conductor",
      ),

      driverName: requiredText(
        guide.driver_name,
        "La guía no tiene nombre del conductor",
      ),

      vehiclePlate: guide.vehicle_plate || undefined,

      carrierRut: guide.carrier_rut || undefined,

      destinationAddress: guide.destination_address,

      destinationCommune: guide.destination_commune,

      destinationCity: guide.destination_city || undefined,

      departureDate: guide.departure_date,

      departureTime: guide.departure_time,

      arrivalDate: guide.arrival_date,
    },

    items: items.map((item: any) => ({
      description: item.garment_description,

      quantity: Number(item.quantity),

      unitPrice: Number(item.unit_value || 0),
    })),
  };

  return payload;
}

/**
 * =========================================================
 * PROCESAR EN MOTOR
 * =========================================================
 */

export async function processDispatchGuide(guideId: string) {
  const guide = await DispatchGuide.findByPk(guideId);

  if (!guide) {
    throw new Error("Guía de despacho no encontrada");
  }

  if (guide.status === "accepted") {
    return getDispatchGuideById(guide.id);
  }

  try {
    await guide.update({
      status: "processing",

      engine_error: null,
    });

    const payload = await buildEnginePayload(guide);

    let engineDocumentId = guide.engine_document_id;

    if (!engineDocumentId) {
      const engineDocument = await createEngineInvoice(payload);

      engineDocumentId = engineDocument.id;

      await guide.update({
        engine_document_id: engineDocument.id,

        engine_status: engineDocument.status,

        engine_folio: engineDocument.folio ?? null,

        engine_error: null,
      });
    }

    const engineResult = await processEngineInvoice(engineDocumentId);

    let status = "processing";

    if (engineResult.status === "accepted") {
      status = "accepted";
    }

    if (engineResult.status === "rejected" || engineResult.status === "error") {
      status = "error";
    }

    await guide.update({
      status,

      engine_status: engineResult.status,

      engine_folio: engineResult.folio ?? guide.engine_folio,

      engine_track_id: engineResult.sii?.track_id ?? guide.engine_track_id,

      engine_error:
        status === "error"
          ? engineResult.sii?.status || "El Motor rechazó la guía"
          : null,

      processed_at: new Date(),
    });

    return getDispatchGuideById(guide.id);
  } catch (error: any) {
    await guide.update({
      status: "error",

      engine_status: "error",

      engine_error:
        error?.message || "Error comunicando con Motor de Facturación",

      processed_at: new Date(),
    });

    throw error;
  }
}

/**
 * =========================================================
 * CREACIÓN MANUAL
 * =========================================================
 *
 * Conservamos POST /dispatch-guides por compatibilidad,
 * aunque el flujo normal será dispatch-to-client.
 * =========================================================
 */

export async function createDispatchGuide(input: DispatchGuideLogisticsInput) {
  const transaction = await sequelize.transaction();

  try {
    const guide = await createDispatchGuideSnapshot({
      ...input,
      transaction,
    });

    await transaction.commit();

    return processDispatchGuide(guide.id);
  } catch (error) {
    await transaction.rollback();

    throw error;
  }
}

/**
 * =========================================================
 * RETRY
 * =========================================================
 */

export async function retryDispatchGuide(guideId: string) {
  return processDispatchGuide(guideId);
}

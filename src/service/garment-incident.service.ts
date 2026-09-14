import type { Transaction } from "sequelize";

import {
  GarmentBatch,
  GarmentBatchItem,
  GarmentIncident,
  MovementStatus,
  sequelize,
} from "../models/index.js";

import {
  createGarmentMovement,
  getBatchGarmentStatusBalance,
} from "./garment-movement.service.js";

export type IncidentReason =
  "NOT_RECEIVED" | "MISSING" | "DAMAGED" | "DISPATCH_DIFFERENCE" | "OTHER";

export type BillingResolution = "PENDING_REVIEW" | "BILLABLE" | "NON_BILLABLE";

export type CreateGarmentIncidentInput = {
  batch_id: string;
  garment_id: string;
  origin_status_id: string;
  quantity: number;
  reason: IncidentReason;
  description?: string | null;
  billing_resolution?: BillingResolution;
  created_by: string;
};

const ALLOWED_INCIDENT_ORIGINS = new Set([
  "PENDIENTE_RECEPCION",
  "EN_TRASLADO",
]);

async function evaluateBatchResolution(
  batchId: string,
  transaction: Transaction,
) {
  const batch = await GarmentBatch.findByPk(batchId, {
    transaction,
    lock: transaction.LOCK.UPDATE,
  });

  if (!batch) throw new Error("Lote no encontrado");

  const closedStatus = await MovementStatus.findOne({
    where: { code: "CERRADO" },
    transaction,
  });

  const incidentStatus = await MovementStatus.findOne({
    where: { code: "RESUELTO_INCIDENCIA" },
    transaction,
  });

  if (!closedStatus || !incidentStatus) {
    throw new Error(
      "No están configurados los estados CERRADO y RESUELTO_INCIDENCIA",
    );
  }

  const items = await GarmentBatchItem.findAll({
    where: { batch_id: batchId },
    transaction,
    lock: transaction.LOCK.UPDATE,
  });

  if (items.length === 0) return false;

  for (const item of items) {
    const sent = Number(item.quantity_sent || 0);

    const closed = await getBatchGarmentStatusBalance(
      batchId,
      item.garment_id,
      closedStatus.id,
      transaction,
    );

    const incident = await getBatchGarmentStatusBalance(
      batchId,
      item.garment_id,
      incidentStatus.id,
      transaction,
    );

    if (closed + incident < sent) return false;
  }

  await batch.update({ current_status_id: closedStatus.id }, { transaction });

  return true;
}

async function executeCreateGarmentIncident(
  input: CreateGarmentIncidentInput,
  transaction: Transaction,
) {
  const quantity = Number(input.quantity);

  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error(
      "La cantidad de la incidencia debe ser un entero mayor a 0",
    );
  }

  const batch = await GarmentBatch.findByPk(input.batch_id, {
    transaction,
    lock: transaction.LOCK.UPDATE,
  });

  if (!batch) throw new Error("Lote no encontrado");

  const item = await GarmentBatchItem.findOne({
    where: {
      batch_id: input.batch_id,
      garment_id: input.garment_id,
    },
    transaction,
    lock: transaction.LOCK.UPDATE,
  });

  if (!item) throw new Error("La prenda no existe en el lote");

  const originStatus = await MovementStatus.findByPk(input.origin_status_id, {
    transaction,
  });

  if (!originStatus) throw new Error("Estado origen no encontrado");

  if (!ALLOWED_INCIDENT_ORIGINS.has(originStatus.code)) {
    throw new Error(
      `No se permite cerrar con incidencia desde ${originStatus.code}`,
    );
  }

  const incidentStatus = await MovementStatus.findOne({
    where: { code: "RESUELTO_INCIDENCIA" },
    transaction,
  });

  if (!incidentStatus) {
    throw new Error("El estado RESUELTO_INCIDENCIA no está configurado");
  }

  const available = await getBatchGarmentStatusBalance(
    input.batch_id,
    input.garment_id,
    originStatus.id,
    transaction,
  );

  if (available < quantity) {
    throw new Error(
      `El lote solo dispone de ${available} unidades para resolver con incidencia desde ${originStatus.code}`,
    );
  }

  const movement = await createGarmentMovement(
    {
      batch_id: input.batch_id,
      garment_id: input.garment_id,
      from_status_id: originStatus.id,
      to_status_id: incidentStatus.id,
      quantity,
      movement_type: "cierre_incidencia",
      created_by: input.created_by,
      notes: input.description || null,
    },
    transaction,
  );

  const incident = await GarmentIncident.create(
    {
      batch_id: input.batch_id,
      garment_id: input.garment_id,
      movement_id: movement.id,
      origin_status_id: originStatus.id,
      quantity,
      reason: input.reason,
      description: input.description || null,
      resolution_status: "RESOLVED",
      billing_resolution: input.billing_resolution || "PENDING_REVIEW",
      created_by: input.created_by,
      resolved_at: new Date(),
    },
    { transaction },
  );

  const batchResolved = await evaluateBatchResolution(
    input.batch_id,
    transaction,
  );

  return {
    incident,
    movement,
    batch_resolved: batchResolved,
  };
}

export async function createGarmentIncident(
  input: CreateGarmentIncidentInput,
  externalTransaction?: Transaction,
) {
  if (externalTransaction) {
    return executeCreateGarmentIncident(input, externalTransaction);
  }

  return sequelize.transaction(async (transaction) => {
    return executeCreateGarmentIncident(input, transaction);
  });
}

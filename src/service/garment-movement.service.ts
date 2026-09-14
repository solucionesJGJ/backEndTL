import type { Transaction } from "sequelize";

import {
  Garment,
  GarmentBatch,
  GarmentBatchItem,
  GarmentMovement,
  GarmentStock,
  MovementStatus,
  sequelize,
} from "../models/index.js";

export type CreateMovementInput = {
  batch_id: string;
  garment_id: string;
  from_status_id?: string | null;
  to_status_id: string;
  quantity: number;
  movement_type: string;
  created_by: string;
  notes?: string | null;
};

export async function getBatchGarmentStatusBalance(
  batchId: string,
  garmentId: string,
  statusId: string,
  transaction?: Transaction,
): Promise<number> {
  const movements = await GarmentMovement.findAll({
    where: {
      batch_id: batchId,
      garment_id: garmentId,
    },

    attributes: ["from_status_id", "to_status_id", "quantity"],

    transaction,
  });

  let balance = 0;

  for (const movement of movements) {
    const quantity = Number(movement.quantity || 0);

    /*
     * Entradas al estado.
     */

    if (movement.to_status_id === statusId) {
      balance += quantity;
    }

    /*
     * Salidas desde el estado.
     */

    if (movement.from_status_id === statusId) {
      balance -= quantity;
    }
  }

  return balance;
}
/*
 * =========================================================
 * EJECUTAR MOVIMIENTO
 * =========================================================
 *
 * Esta función contiene la lógica real.
 *
 * IMPORTANTE:
 * NO crea ni confirma transacciones.
 * Siempre recibe una transacción existente.
 *
 * Esto permite reutilizarla tanto:
 *
 * - desde un movimiento individual
 * - como dentro de operaciones masivas de lote
 *
 * =========================================================
 */

async function executeGarmentMovement(
  input: CreateMovementInput,
  transaction: Transaction,
) {
  /*
   * =====================================================
   * VALIDAR CANTIDAD
   * =====================================================
   */

  const quantity = Number(input.quantity);

  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error("La cantidad debe ser un entero mayor a 0");
  }

  /*
   * =====================================================
   * LOTE
   * =====================================================
   */

  const batch = await GarmentBatch.findByPk(input.batch_id, {
    transaction,

    lock: transaction.LOCK.UPDATE,
  });

  if (!batch) {
    throw new Error("Lote no encontrado");
  }

  /*
   * =====================================================
   * PRENDA
   * =====================================================
   */

  const garment = await Garment.findByPk(input.garment_id, {
    transaction,
  });

  if (!garment) {
    throw new Error("Prenda no encontrada");
  }

  /*
   * La prenda debe pertenecer
   * al mismo cliente del lote.
   */

  if (garment.client_id !== batch.client_id) {
    throw new Error("La prenda no pertenece al cliente del lote");
  }

  /*
   * =====================================================
   * ITEM DEL LOTE
   * =====================================================
   */

  const batchItem = await GarmentBatchItem.findOne({
    where: {
      batch_id: input.batch_id,

      garment_id: input.garment_id,
    },

    transaction,

    lock: transaction.LOCK.UPDATE,
  });

  if (!batchItem) {
    throw new Error("La prenda no existe en el lote");
  }

  /*
   * =====================================================
   * ESTADO DESTINO
   * =====================================================
   */

  const toStatus = await MovementStatus.findByPk(input.to_status_id, {
    transaction,
  });

  if (!toStatus) {
    throw new Error("Estado destino no encontrado");
  }

  /*
   * =====================================================
   * ESTADO ORIGEN
   * =====================================================
   */

  let fromStatus: MovementStatus | null = null;

  if (input.from_status_id) {
    fromStatus = await MovementStatus.findByPk(input.from_status_id, {
      transaction,
    });

    if (!fromStatus) {
      throw new Error("Estado origen no encontrado");
    }

    if (fromStatus.id === toStatus.id) {
      throw new Error("El estado origen y destino no pueden ser iguales");
    }
  }

  /*
   * =====================================================
   * VALIDAR TRANSICIONES FUNCIONALES
   * =====================================================
   *
   * No bloqueamos movimientos históricos antiguos,
   * pero sí protegemos el flujo operativo nuevo.
   *
   * Flujo:
   *
   * PENDIENTE_RECEPCION -> EN_PROCESO
   * EN_PROCESO          -> EN_TRASLADO
   * EN_TRASLADO         -> CERRADO
   *
   * BORRADOR -> PENDIENTE se realiza actualmente
   * desde dispatchClientBatch().
   *
   * =====================================================
   */

  if (fromStatus) {
    const functionalTransitions: Record<string, string[]> = {
      PENDIENTE_RECEPCION: ["EN_PROCESO", "RESUELTO_INCIDENCIA"],

      EN_PROCESO: ["EN_TRASLADO"],

      EN_TRASLADO: ["CERRADO", "RESUELTO_INCIDENCIA"],
    };

    const allowedDestinations = functionalTransitions[fromStatus.code];

    /*
     * Solo aplicamos la matriz estricta
     * a estados pertenecientes al flujo nuevo.
     *
     * Esto evita romper movimientos históricos
     * que todavía utilicen códigos antiguos.
     */

    if (allowedDestinations && !allowedDestinations.includes(toStatus.code)) {
      throw new Error(
        `No se permite mover la prenda de ${fromStatus.code} a ${toStatus.code}`,
      );
    }
  }

  /*
   * =====================================================
   * STOCK ORIGEN
   * =====================================================
   */

  if (input.from_status_id) {
    /*
     * =====================================================
     * DISPONIBILIDAD REAL DEL LOTE
     * =====================================================
     */

    const batchAvailableQuantity = await getBatchGarmentStatusBalance(
      input.batch_id,
      input.garment_id,
      input.from_status_id,
      transaction,
    );

    if (batchAvailableQuantity < quantity) {
      throw new Error(
        `El lote solo dispone de ${batchAvailableQuantity} unidades de esta prenda en el estado origen`,
      );
    }

    /*
     * =====================================================
     * STOCK GLOBAL DEL CLIENTE
     * =====================================================
     */

    const fromStock = await GarmentStock.findOne({
      where: {
        client_id: batch.client_id,

        garment_id: input.garment_id,

        status_id: input.from_status_id,
      },

      transaction,

      lock: transaction.LOCK.UPDATE,
    });

    if (!fromStock || Number(fromStock.quantity) < quantity) {
      throw new Error("Stock insuficiente en el estado origen");
    }

    await fromStock.update(
      {
        quantity: Number(fromStock.quantity) - quantity,
      },
      {
        transaction,
      },
    );
  }

  /*
   * =====================================================
   * STOCK DESTINO
   * =====================================================
   */

  const [toStock] = await GarmentStock.findOrCreate({
    where: {
      client_id: batch.client_id,

      garment_id: input.garment_id,

      status_id: input.to_status_id,
    },

    defaults: {
      client_id: batch.client_id,

      garment_id: input.garment_id,

      status_id: input.to_status_id,

      quantity: 0,
    },

    transaction,

    lock: transaction.LOCK.UPDATE,
  });

  await toStock.update(
    {
      quantity: Number(toStock.quantity) + quantity,
    },
    {
      transaction,
    },
  );

  /*
   * =====================================================
   * MOVIMIENTO HISTÓRICO
   * =====================================================
   */

  const movement = await GarmentMovement.create(
    {
      batch_id: input.batch_id,

      garment_id: input.garment_id,

      from_status_id: input.from_status_id || null,

      to_status_id: input.to_status_id,

      quantity,

      movement_type: input.movement_type,

      created_by: input.created_by,

      notes: input.notes || null,
    },
    {
      transaction,
    },
  );

  /*
   * =====================================================
   * CANTIDADES ACTUALES DEL ITEM
   * =====================================================
   */

  const quantitySent = Number(batchItem.quantity_sent || 0);

  const quantityReceived = Number(batchItem.quantity_received || 0);

  const quantityReturned = Number(batchItem.quantity_returned || 0);

  const itemUpdate: Partial<GarmentBatchItem> = {};

  /*
   * =====================================================
   * RECEPCIÓN EN PLANTA
   * =====================================================
   *
   * El flujo nuevo no utiliza RECEPCIONADO
   * como estado intermedio.
   *
   * PENDIENTE_RECEPCION -> EN_PROCESO
   *
   * representa la recepción física de esas
   * unidades en planta.
   */

  if (
    fromStatus?.code === "PENDIENTE_RECEPCION" &&
    toStatus.code === "EN_PROCESO"
  ) {
    const nextReceived = quantityReceived + quantity;

    if (nextReceived > quantitySent) {
      throw new Error(
        "La cantidad recepcionada no puede superar la cantidad enviada",
      );
    }

    itemUpdate.quantity_received = nextReceived;

    /*
     * En el flujo simplificado, lo recibido
     * queda en estado funcional PROCESADO.
     */

    itemUpdate.quantity_processed = nextReceived;
  }

  /*
   * =====================================================
   * COMPATIBILIDAD CON RECEPCIONADO ANTIGUO
   * =====================================================
   */

  if (toStatus.code === "RECEPCIONADO") {
    const nextReceived = quantityReceived + quantity;

    if (nextReceived > quantitySent) {
      throw new Error(
        "La cantidad recepcionada no puede superar la cantidad enviada",
      );
    }

    itemUpdate.quantity_received = nextReceived;
  }

  /*
   * =====================================================
   * CIERRE
   * =====================================================
   *
   * EN_TRASLADO -> CERRADO
   *
   * significa que las unidades fueron
   * recibidas/conformes en destino.
   */

  if (fromStatus?.code === "EN_TRASLADO" && toStatus.code === "CERRADO") {
    const nextReturned = quantityReturned + quantity;

    if (nextReturned > quantitySent) {
      throw new Error(
        "La cantidad cerrada no puede superar la cantidad enviada",
      );
    }

    itemUpdate.quantity_returned = nextReturned;
  }

  /*
   * =====================================================
   * COMPATIBILIDAD RETORNADO_CLIENTE ANTIGUO
   * =====================================================
   */

  if (toStatus.code === "RETORNADO_CLIENTE") {
    const nextReturned = quantityReturned + quantity;

    if (nextReturned > quantitySent) {
      throw new Error(
        "La cantidad retornada no puede superar la cantidad enviada",
      );
    }

    itemUpdate.quantity_returned = nextReturned;
  }

  /*
   * =====================================================
   * ACTUALIZAR ITEM
   * =====================================================
   */

  if (Object.keys(itemUpdate).length > 0) {
    await batchItem.update(itemUpdate, {
      transaction,
    });
  }

  /*
   * =====================================================
   * AVANCE AUTOMÁTICO DEL LOTE POR RECEPCIÓN COMPLETA
   * =====================================================
   */

  if (
    fromStatus?.code === "PENDIENTE_RECEPCION" &&
    toStatus.code === "EN_PROCESO"
  ) {
    const batchItems = await GarmentBatchItem.findAll({
      where: {
        batch_id: input.batch_id,
      },

      transaction,

      lock: transaction.LOCK.UPDATE,
    });

    const receptionComplete = batchItems.every((item) => {
      return (
        Number(item.quantity_received || 0) >= Number(item.quantity_sent || 0)
      );
    });

    if (receptionComplete) {
      await batch.update(
        {
          current_status_id: toStatus.id,

          received_at: batch.received_at || new Date(),
        },
        {
          transaction,
        },
      );
    }
  }

  /*
   * =====================================================
   * CIERRE AUTOMÁTICO DEL LOTE
   * =====================================================
   *
   * Solo cerramos el lote completo cuando TODAS las
   * cantidades originalmente enviadas fueron retornadas
   * y confirmadas por el cliente.
   *
   * Si quedan unidades:
   * - pendientes de recepción
   * - en proceso
   * - en traslado
   *
   * el lote permanece abierto.
   *
   * Más adelante podremos agregar "cierre con incidencia"
   * para resolver faltantes sin falsear la trazabilidad.
   */

  if (fromStatus?.code === "EN_TRASLADO" && toStatus.code === "CERRADO") {
    const batchItems = await GarmentBatchItem.findAll({
      where: {
        batch_id: input.batch_id,
      },

      transaction,

      lock: transaction.LOCK.UPDATE,
    });

    const allReturned = batchItems.every((item) => {
      return (
        Number(item.quantity_returned || 0) >= Number(item.quantity_sent || 0)
      );
    });

    if (allReturned) {
      await batch.update(
        {
          current_status_id: toStatus.id,
        },
        {
          transaction,
        },
      );
    }
  }

  return movement;
}

/*
 * =========================================================
 * API PÚBLICA
 * =========================================================
 *
 * Si recibimos una transacción externa:
 * utilizamos esa misma transacción.
 *
 * Si NO recibimos una transacción:
 * creamos una propia.
 *
 * =========================================================
 */

export async function createGarmentMovement(
  input: CreateMovementInput,
  externalTransaction?: Transaction,
) {
  if (externalTransaction) {
    return executeGarmentMovement(input, externalTransaction);
  }

  return sequelize.transaction(async (transaction) => {
    return executeGarmentMovement(input, transaction);
  });
}

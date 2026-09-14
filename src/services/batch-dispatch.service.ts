import {
  GarmentBatch,
  GarmentBatchItem,
  MovementStatus,
  sequelize,
} from "../models/index.js";

import {
  createGarmentMovement,
  getBatchGarmentStatusBalance,
} from "../service/garment-movement.service.js";

import {
  createDispatchGuideSnapshot,
  getDispatchGuideById,
  processDispatchGuide,
} from "./dispatch-guide.service.js";

/**
 * =========================================================
 * TIPOS
 * =========================================================
 */

export type DispatchBatchToClientInput = {
  batch_id: string;

  generate_guide: boolean;

  /**
   * Segunda confirmación proveniente del frontend.
   *
   * Obligatoria cuando generate_guide = false.
   */
  confirm_without_guide?: boolean;

  driver_shift_id?: string | null;
  driver_user_id?: string | null;
  vehicle_id?: string | null;

  transfer_indicator?: number;
  dispatch_type?: number;

  departure_date?: string;
  departure_time?: string;
  arrival_date?: string;

  requested_by: string;

  notes?: string | null;
};

export type DispatchBatchToClientResult = {
  batch: GarmentBatch;

  guide: any | null;

  guide_requested: boolean;

  guide_processed: boolean;

  guide_error: string | null;
};

/**
 * =========================================================
 * DESPACHAR LOTE A CLIENTE
 * =========================================================
 */

export async function dispatchBatchToClient(
  input: DispatchBatchToClientInput,
): Promise<DispatchBatchToClientResult> {
  if (!input.batch_id) {
    throw new Error("batch_id es obligatorio");
  }

  if (!input.requested_by) {
    throw new Error("requested_by es obligatorio");
  }

  if (typeof input.generate_guide !== "boolean") {
    throw new Error("generate_guide debe ser boolean");
  }

  /**
   * =====================================================
   * SEGURIDAD DESPACHO SIN GUÍA
   * =====================================================
   */

  if (!input.generate_guide && input.confirm_without_guide !== true) {
    throw new Error("Debe confirmar explícitamente el despacho sin guía");
  }

  const transaction = await sequelize.transaction();

  let guideId: string | null = null;

  try {
    /**
     * =================================================
     * LOTE
     * =================================================
     */

    const batch = await GarmentBatch.findByPk(input.batch_id, {
      transaction,

      lock: transaction.LOCK.UPDATE,
    });

    if (!batch) {
      throw new Error("Lote no encontrado");
    }

    /**
     * =================================================
     * ESTADOS FUNCIONALES
     * =================================================
     */

    const processStatus = await MovementStatus.findOne({
      where: {
        code: "EN_PROCESO",
      },

      transaction,
    });

    const transitStatus = await MovementStatus.findOne({
      where: {
        code: "EN_TRASLADO",
      },

      transaction,
    });

    if (!processStatus || !transitStatus) {
      throw new Error("No existen los estados EN_PROCESO o EN_TRASLADO");
    }

    /**
     * =================================================
     * VALIDAR ESTADO DEL LOTE
     * =================================================
     */

    if (batch.current_status_id !== processStatus.id) {
      throw new Error(
        "Solo se pueden despachar al cliente lotes en estado EN_PROCESO",
      );
    }

    /**
     * =================================================
     * ITEMS
     * =================================================
     */

    const items = await GarmentBatchItem.findAll({
      where: {
        batch_id: batch.id,
      },

      transaction,

      lock: transaction.LOCK.UPDATE,
    });

    if (items.length === 0) {
      throw new Error("El lote no tiene prendas");
    }

    /**
     * =================================================
     * CALCULAR SALDOS REALES EN PROCESO
     * =================================================
     */

    const dispatchLines: Array<{
      garment_id: string;
      quantity: number;
    }> = [];

    for (const item of items) {
      const quantity = await getBatchGarmentStatusBalance(
        batch.id,
        item.garment_id,
        processStatus.id,
        transaction,
      );

      if (quantity > 0) {
        dispatchLines.push({
          garment_id: item.garment_id,

          quantity,
        });
      }
    }

    if (dispatchLines.length === 0) {
      throw new Error(
        "El lote no tiene prendas disponibles en EN_PROCESO para despachar",
      );
    }

    /**
     * =================================================
     * CREAR GUÍA LOCAL SI FUE SOLICITADA
     * =================================================
     *
     * Ocurre ANTES de retirar las prendas de EN_PROCESO,
     * porque el snapshot de la guía lee precisamente
     * esos saldos.
     *
     * Todo sigue dentro de la misma transacción.
     */

    if (input.generate_guide) {
      const guide = await createDispatchGuideSnapshot({
        batch_id: batch.id,

        driver_shift_id: input.driver_shift_id || null,

        driver_user_id: input.driver_user_id || null,

        vehicle_id: input.vehicle_id || null,

        transfer_indicator: input.transfer_indicator,

        dispatch_type: input.dispatch_type,

        departure_date: input.departure_date,

        departure_time: input.departure_time,

        arrival_date: input.arrival_date,

        requested_by: input.requested_by,

        transaction,
      });

      guideId = guide.id;
    }

    /**
     * =================================================
     * MOVIMIENTOS
     *
     * EN_PROCESO -> EN_TRASLADO
     * =================================================
     */

    for (const line of dispatchLines) {
      const movement = await createGarmentMovement(
        {
          batch_id: batch.id,

          garment_id: line.garment_id,

          from_status_id: processStatus.id,

          to_status_id: transitStatus.id,

          quantity: line.quantity,

          movement_type: "inicio_traslado",

          created_by: input.requested_by,

          notes:
            input.notes ||
            (input.generate_guide
              ? "Despacho a cliente con guía de despacho"
              : "Despacho a cliente sin guía de despacho"),
        },

        transaction,
      );

      /**
       * Si existe guía, enlazamos el movimiento
       * real con su línea correspondiente.
       */
      if (guideId) {
        const { DispatchGuideItem } = await import("../models/index.js");

        await DispatchGuideItem.update(
          {
            movement_id: movement.id,
          },
          {
            where: {
              dispatch_guide_id: guideId,

              garment_id: line.garment_id,
            },

            transaction,
          },
        );
      }
    }

    /**
     * =================================================
     * ESTADO GLOBAL DEL LOTE
     * =================================================
     */

    await batch.update(
      {
        current_status_id: transitStatus.id,

        destination_location: "Cliente",

        notes: [
          batch.notes,

          input.generate_guide
            ? "Despachado desde planta a cliente con guía de despacho"
            : "Despachado desde planta a cliente sin guía de despacho",

          input.notes ? `Observación despacho: ${input.notes}` : null,
        ]
          .filter(Boolean)
          .join("\n"),
      },
      {
        transaction,
      },
    );

    /**
     * =================================================
     * COMMIT TL
     * =================================================
     */

    await transaction.commit();

    /**
     * =================================================
     * MOTOR
     * =================================================
     *
     * La operación física TL ya quedó registrada.
     *
     * Si Motor falla:
     *
     * - NO revertimos el despacho real.
     * - la guía queda en error.
     * - puede reintentarse.
     */

    let guide: any | null = null;

    let guideProcessed = false;

    let guideError: string | null = null;

    if (guideId) {
      try {
        guide = await processDispatchGuide(guideId);

        guideProcessed = true;
      } catch (error: any) {
        guideError = error?.message || "Error procesando guía en Motor";

        guide = await getDispatchGuideById(guideId);
      }
    }

    /**
     * Recargamos lote tras commit.
     */
    const finalBatch = await GarmentBatch.findByPk(batch.id);

    if (!finalBatch) {
      throw new Error("No fue posible recargar el lote despachado");
    }

    return {
      batch: finalBatch,

      guide,

      guide_requested: input.generate_guide,

      guide_processed: guideProcessed,

      guide_error: guideError,
    };
  } catch (error) {
    if (!(transaction as any).finished) {
      await transaction.rollback();
    }

    throw error;
  }
}

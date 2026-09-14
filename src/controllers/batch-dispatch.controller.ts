import type { Request, Response } from "express";

import { DriverShift, User, Vehicle } from "../models/index.js";

import { dispatchBatchToClient } from "../services/batch-dispatch.service.js";

/**
 * =========================================================
 * ERROR STATUS
 * =========================================================
 */

function getErrorStatus(message: string) {
  const normalized = message.toLowerCase();

  if (
    normalized.includes("no encontrado") ||
    normalized.includes("no existe")
  ) {
    return 404;
  }

  if (
    normalized.includes("obligatorio") ||
    normalized.includes("debe ") ||
    normalized.includes("solo se pueden") ||
    normalized.includes("sin guía") ||
    normalized.includes("no tiene prendas") ||
    normalized.includes("no se encuentra activa")
  ) {
    return 400;
  }

  return 500;
}

/**
 * =========================================================
 * GET
 * /operator/dispatch-driver-shifts
 *
 * Jornadas activas disponibles para despacho.
 * =========================================================
 */

export async function getActiveDispatchDriverShiftsController(
  _req: Request,
  res: Response,
) {
  try {
    const shifts = await DriverShift.findAll({
      where: {
        status: "started",
      },

      include: [
        {
          model: User,

          as: "driver",

          attributes: ["id", "name", "rut", "email"],
        },

        {
          model: Vehicle,

          as: "vehicle",
        },
      ],

      order: [["createdAt", "DESC"]],
    });

    return res.json({
      ok: true,

      data: shifts,
    });
  } catch (error: any) {
    console.error("Error obteniendo jornadas activas para despacho:", error);

    return res.status(500).json({
      ok: false,

      message: error?.message || "Error obteniendo jornadas activas",
    });
  }
}

/**
 * =========================================================
 * PATCH
 * /operator/batches/:id/dispatch-to-client
 * =========================================================
 */

export async function dispatchBatchToClientController(
  req: Request,
  res: Response,
) {
  try {
    const user = req.user;

    if (!user) {
      return res.status(401).json({
        ok: false,

        message: "Usuario no autenticado",
      });
    }

    const batchId =
      typeof req.params.id === "string" ? req.params.id.trim() : "";

    if (!batchId) {
      return res.status(400).json({
        ok: false,

        message: "Id de lote inválido",
      });
    }

    const {
      generate_guide,
      confirm_without_guide,

      driver_shift_id,
      driver_user_id,
      vehicle_id,

      transfer_indicator,
      dispatch_type,

      departure_date,
      departure_time,
      arrival_date,

      notes,
    } = req.body ?? {};

    if (typeof generate_guide !== "boolean") {
      return res.status(400).json({
        ok: false,

        message: "generate_guide debe ser boolean",
      });
    }

    /**
     * Protección backend.
     *
     * El frontend también pregunta dos veces,
     * pero no dependemos sólo de él.
     */
    if (generate_guide === false && confirm_without_guide !== true) {
      return res.status(400).json({
        ok: false,

        message: "Debe confirmar explícitamente el despacho sin guía",
      });
    }

    const result = await dispatchBatchToClient({
      batch_id: batchId,

      generate_guide,

      confirm_without_guide: confirm_without_guide === true,

      driver_shift_id:
        typeof driver_shift_id === "string" && driver_shift_id.trim()
          ? driver_shift_id.trim()
          : null,

      driver_user_id:
        typeof driver_user_id === "string" && driver_user_id.trim()
          ? driver_user_id.trim()
          : null,

      vehicle_id:
        typeof vehicle_id === "string" && vehicle_id.trim()
          ? vehicle_id.trim()
          : null,

      transfer_indicator:
        transfer_indicator !== undefined
          ? Number(transfer_indicator)
          : undefined,

      dispatch_type:
        dispatch_type !== undefined ? Number(dispatch_type) : undefined,

      departure_date:
        typeof departure_date === "string" && departure_date.trim()
          ? departure_date.trim()
          : undefined,

      departure_time:
        typeof departure_time === "string" && departure_time.trim()
          ? departure_time.trim()
          : undefined,

      arrival_date:
        typeof arrival_date === "string" && arrival_date.trim()
          ? arrival_date.trim()
          : undefined,

      requested_by: user.id,

      notes: typeof notes === "string" && notes.trim() ? notes.trim() : null,
    });

    let message = "Lote despachado al cliente correctamente";

    if (result.guide_requested && result.guide_processed) {
      message = "Lote despachado y guía de despacho procesada correctamente";
    }

    if (result.guide_requested && !result.guide_processed) {
      message =
        "Lote despachado correctamente, pero la guía quedó pendiente de reintento";
    }

    if (!result.guide_requested) {
      message = "Lote despachado al cliente sin guía de despacho";
    }

    return res.json({
      ok: true,

      message,

      data: result,
    });
  } catch (error: any) {
    console.error("Error despachando lote al cliente:", error);

    const message = error?.message || "Error despachando lote al cliente";

    return res.status(getErrorStatus(message)).json({
      ok: false,

      message,
    });
  }
}

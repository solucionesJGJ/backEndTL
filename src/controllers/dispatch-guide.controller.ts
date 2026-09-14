import type { Request, Response } from "express";

import {
  createDispatchGuide,
  getDispatchGuideByBatch,
  getDispatchGuideById,
  listDispatchGuides,
  retryDispatchGuide,
} from "../services/dispatch-guide.service.js";

/**
 * =========================================================
 * HELPERS
 * =========================================================
 */

function getDispatchGuideErrorStatus(message: string) {
  const normalized = message.toLowerCase();

  /**
   * =====================================================
   * NOT FOUND
   * =====================================================
   */

  if (
    normalized.includes("no encontrada") ||
    normalized.includes("no encontrado") ||
    normalized.includes("no existe")
  ) {
    return 404;
  }

  /**
   * =====================================================
   * VALIDACIÓN / REGLAS DE NEGOCIO
   * =====================================================
   */

  if (
    normalized.includes("obligatorio") ||
    normalized.includes("inválid") ||
    normalized.includes("invalido") ||
    normalized.includes("debe ") ||
    normalized.includes("no tiene ") ||
    normalized.includes("no se encuentra activa") ||
    normalized.includes("no tiene prendas preparadas")
  ) {
    return 400;
  }

  return 500;
}

/**
 * =========================================================
 * POST /
 * CREAR / GENERAR GUÍA
 * =========================================================
 */

export async function createDispatchGuideController(
  req: Request,
  res: Response,
) {
  try {
    /**
     * El middleware de autenticación
     * ya deja disponible req.user.
     */
    if (!req.user) {
      return res.status(401).json({
        ok: false,

        message: "Usuario no autenticado",
      });
    }

    const {
      batch_id,
      driver_shift_id,
      driver_user_id,
      vehicle_id,
      transfer_indicator,
      dispatch_type,
      departure_date,
      departure_time,
      arrival_date,
    } = req.body ?? {};

    /**
     * =================================================
     * LOTE
     * =================================================
     */

    if (typeof batch_id !== "string" || !batch_id.trim()) {
      return res.status(400).json({
        ok: false,

        message: "batch_id es obligatorio",
      });
    }

    /**
     * =================================================
     * INDICADOR TRASLADO
     * =================================================
     */

    let transferIndicator: number | undefined;

    if (transfer_indicator !== undefined) {
      transferIndicator = Number(transfer_indicator);

      if (
        !Number.isInteger(transferIndicator) ||
        transferIndicator < 1 ||
        transferIndicator > 9
      ) {
        return res.status(400).json({
          ok: false,

          message: "transfer_indicator debe ser un entero entre 1 y 9",
        });
      }
    }

    /**
     * =================================================
     * TIPO DESPACHO
     * =================================================
     */

    let dispatchType: number | undefined;

    if (dispatch_type !== undefined) {
      dispatchType = Number(dispatch_type);

      if (
        !Number.isInteger(dispatchType) ||
        dispatchType < 1 ||
        dispatchType > 3
      ) {
        return res.status(400).json({
          ok: false,

          message: "dispatch_type debe ser 1, 2 o 3",
        });
      }
    }

    /**
     * =================================================
     * CREAR GUÍA
     * =================================================
     */

    const guide = await createDispatchGuide({
      batch_id: batch_id.trim(),

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

      transfer_indicator: transferIndicator,

      dispatch_type: dispatchType,

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

      requested_by: req.user.id,
    });

    return res.status(201).json({
      ok: true,

      message: "Guía de despacho procesada correctamente",

      data: guide,
    });
  } catch (error: any) {
    console.error("Error creando guía de despacho:", error);

    const message = error?.message || "Error creando guía de despacho";

    return res.status(getDispatchGuideErrorStatus(message)).json({
      ok: false,

      message,
    });
  }
}

/**
 * =========================================================
 * GET /
 * LISTAR GUÍAS
 * =========================================================
 */

export async function listDispatchGuidesController(
  req: Request,
  res: Response,
) {
  try {
    const guides = await listDispatchGuides();

    return res.json({
      ok: true,

      data: guides,
    });
  } catch (error: any) {
    console.error("Error listando guías de despacho:", error);

    return res.status(500).json({
      ok: false,

      message: error?.message || "Error obteniendo guías de despacho",
    });
  }
}

/**
 * =========================================================
 * GET /batch/:batchId
 * BUSCAR GUÍA DEL LOTE
 * =========================================================
 */

export async function getDispatchGuideByBatchController(
  req: Request,
  res: Response,
) {
  try {
    const batchId =
      typeof req.params.batchId === "string" ? req.params.batchId.trim() : "";

    if (!batchId) {
      return res.status(400).json({
        ok: false,

        message: "batchId es obligatorio",
      });
    }

    const guide = await getDispatchGuideByBatch(batchId);

    if (!guide) {
      return res.status(404).json({
        ok: false,

        message: "El lote todavía no tiene guía de despacho",
      });
    }

    return res.json({
      ok: true,

      data: guide,
    });
  } catch (error: any) {
    console.error("Error buscando guía por lote:", error);

    const message = error?.message || "Error buscando guía de despacho";

    return res.status(getDispatchGuideErrorStatus(message)).json({
      ok: false,

      message,
    });
  }
}

/**
 * =========================================================
 * GET /:id
 * OBTENER DETALLE
 * =========================================================
 */

export async function getDispatchGuideController(req: Request, res: Response) {
  try {
    const id = typeof req.params.id === "string" ? req.params.id.trim() : "";

    if (!id) {
      return res.status(400).json({
        ok: false,

        message: "Id de guía inválido",
      });
    }

    const guide = await getDispatchGuideById(id);

    return res.json({
      ok: true,

      data: guide,
    });
  } catch (error: any) {
    console.error("Error obteniendo guía de despacho:", error);

    const message = error?.message || "Error obteniendo guía de despacho";

    return res.status(getDispatchGuideErrorStatus(message)).json({
      ok: false,

      message,
    });
  }
}

/**
 * =========================================================
 * POST /:id/retry
 * REINTENTAR MOTOR
 * =========================================================
 */

export async function retryDispatchGuideController(
  req: Request,
  res: Response,
) {
  try {
    if (!req.user) {
      return res.status(401).json({
        ok: false,

        message: "Usuario no autenticado",
      });
    }

    const id = typeof req.params.id === "string" ? req.params.id.trim() : "";

    if (!id) {
      return res.status(400).json({
        ok: false,

        message: "Id de guía inválido",
      });
    }

    const guide = await retryDispatchGuide(id);

    return res.json({
      ok: true,

      message: "Guía reprocesada correctamente",

      data: guide,
    });
  } catch (error: any) {
    console.error("Error reprocesando guía:", error);

    const message = error?.message || "Error reprocesando guía de despacho";

    return res.status(getDispatchGuideErrorStatus(message)).json({
      ok: false,

      message,
    });
  }
}

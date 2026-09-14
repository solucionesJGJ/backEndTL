import { Router } from "express";

import {
  createDispatchGuideController,
  getDispatchGuideByBatchController,
  getDispatchGuideController,
  listDispatchGuidesController,
  retryDispatchGuideController,
} from "../controllers/dispatch-guide.controller.js";

import { authMiddleware } from "../middlewares/auth.middleware.js";

import { requireRole } from "../middlewares/role.middleware.js";

import { getDispatchGuidePdfController } from "../controllers/dispatch-guide-pdf.controller.js";

const router = Router();

/**
 * =========================================================
 * AUTENTICACIÓN
 * =========================================================
 */

router.use(authMiddleware);

/**
 * =========================================================
 * GUÍAS DE DESPACHO DTE52
 * =========================================================
 *
 * Acceso:
 *
 * admin
 * warehouse_operator
 *
 * El cliente no administra documentos tributarios
 * ni el transportista consulta el módulo completo.
 */

/**
 * =========================================================
 * LISTAR GUÍAS
 *
 * GET
 * /api/dispatch-guides
 * =========================================================
 */

router.get(
  "/",

  requireRole("admin", "warehouse_operator"),

  listDispatchGuidesController,
);

router.get(
  "/:id/pdf",
  requireRole("admin", "warehouse_operator"),
  getDispatchGuidePdfController,
);

/**
 * =========================================================
 * BUSCAR GUÍA POR LOTE
 *
 * GET
 * /api/dispatch-guides/batch/:batchId
 *
 * IMPORTANTE:
 * Debe declararse antes de /:id.
 * =========================================================
 */

router.get(
  "/batch/:batchId",

  requireRole("admin", "warehouse_operator"),

  getDispatchGuideByBatchController,
);

/**
 * =========================================================
 * CREAR / GENERAR GUÍA
 *
 * POST
 * /api/dispatch-guides
 *
 * Sólo planta / administración puede iniciar
 * el despacho con DTE52.
 * =========================================================
 */

router.post(
  "/",

  requireRole("admin", "warehouse_operator"),

  createDispatchGuideController,
);

/**
 * =========================================================
 * REINTENTAR MOTOR
 *
 * POST
 * /api/dispatch-guides/:id/retry
 * =========================================================
 */

router.post(
  "/:id/retry",

  requireRole("admin", "warehouse_operator"),

  retryDispatchGuideController,
);

/**
 * =========================================================
 * OBTENER DETALLE
 *
 * GET
 * /api/dispatch-guides/:id
 *
 * Se deja al final para no capturar
 * rutas específicas como /batch/:batchId.
 * =========================================================
 */

router.get(
  "/:id",

  requireRole("admin", "warehouse_operator"),

  getDispatchGuideController,
);

export default router;

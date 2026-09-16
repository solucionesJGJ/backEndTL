import { Router } from "express";

import {
  downloadDriverShiftTicket,
  finishDriverShift,
  getAllDriverShifts,
  getCurrentDriverShift,
  getDriverChecklist,
  getDriverShiftDriverPhoto,
  getDriverShiftHistory,
  getDriverShiftVehiclePhoto,
  startDriverShift,
} from "../controllers/driver-shift.controller.js";

import { authMiddleware } from "../middlewares/auth.middleware.js";

import { requireRole } from "../middlewares/role.middleware.js";

import {
  driverShiftPhotoFields,
} from "../middlewares/driver-shift-upload.middleware.js";

const router = Router();

router.use(authMiddleware);

router.get(
  "/checklist",
  requireRole("admin", "transportista"),
  getDriverChecklist,
);

router.get(
  "/current",
  requireRole("admin", "transportista"),
  getCurrentDriverShift,
);

router.get(
  "/history",
  requireRole("admin", "transportista"),
  getDriverShiftHistory,
);

router.post(
  "/start",
  requireRole("admin", "transportista"),
  driverShiftPhotoFields,
  startDriverShift,
);

router.patch(
  "/finish",
  requireRole("admin", "transportista"),
  finishDriverShift,
);

/**
 * =========================================================
 * ADMINISTRACIÓN DE JORNADAS
 * =========================================================
 */

router.get(
  "/admin/history",
  requireRole("admin"),
  getAllDriverShifts,
);

/**
 * Evidencias fotográficas.
 *
 * Se mantienen protegidas por autenticación
 * y exclusivamente disponibles para admin.
 */
router.get(
  "/:id/photo/driver",
  requireRole("admin"),
  getDriverShiftDriverPhoto,
);

router.get(
  "/:id/photo/vehicle",
  requireRole("admin"),
  getDriverShiftVehiclePhoto,
);

/**
 * Comprobante PDF.
 */
router.get(
  "/:id/ticket",
  requireRole("admin", "transportista"),
  downloadDriverShiftTicket,
);

export default router;
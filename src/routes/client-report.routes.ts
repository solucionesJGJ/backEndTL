import { Router } from "express";

import { getClients } from "../controllers/client-report.controller.js";

import { authMiddleware } from "../middlewares/auth.middleware.js";

import { requireRole } from "../middlewares/role.middleware.js";

const router = Router();

router.use(authMiddleware);

/**
 * Reportería de lotes/prendas.
 *
 * Cliente:
 * ve solamente su información.
 *
 * Admin:
 * puede consultar todos.
 */
router.get(
  "/client-batches",
  requireRole("admin", "client_operator"),
  getClients,
);

export default router;

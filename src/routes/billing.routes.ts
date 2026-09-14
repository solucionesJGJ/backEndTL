import { Router } from "express";

import {
  cancelBillingDraft,
  confirmBillingDocument,
  createBillingDraft,
  getAvailableBillingBatches,
  getBillingDocumentById,
  getBillingDocuments,
  getBillingPdf,
  sendBillingDocumentToEngine,
  updateBillingItemDiscount,
  updateIncidentBillingResolution,
} from "../controllers/billing.controller.js";

import { authMiddleware } from "../middlewares/auth.middleware.js";

import { requireRole } from "../middlewares/role.middleware.js";

const router = Router();

router.use(authMiddleware);

/**
 * Por ahora facturación es
 * exclusivamente administrativa.
 */

router.get(
  "/available-batches/:clientId",
  requireRole("admin"),
  getAvailableBillingBatches,
);

router.get("/", requireRole("admin"), getBillingDocuments);

router.post("/", requireRole("admin"), createBillingDraft);

router.patch(
  "/incidents/:incidentId/resolution",
  requireRole("admin"),
  updateIncidentBillingResolution,
);

router.post(
  "/:id/send-to-engine",
  requireRole("admin"),
  sendBillingDocumentToEngine,
);

router.get("/:id", requireRole("admin"), getBillingDocumentById);

router.get("/:id/pdf", requireRole("admin"), getBillingPdf);

router.patch(
  "/:id/items/:itemId/discount",
  requireRole("admin"),
  updateBillingItemDiscount,
);

router.post("/:id/confirm", requireRole("admin"), confirmBillingDocument);

router.patch("/:id/cancel", requireRole("admin"), cancelBillingDraft);

export default router;

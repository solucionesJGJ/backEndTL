import { Router } from "express";
import {
  createClient,
  getClientById,
  getClients,
  updateClient,
} from "../controllers/client.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { requireRole } from "../middlewares/role.middleware.js";

const router = Router();

router.post("/", authMiddleware, requireRole("admin"), createClient);
router.get(
  "/",
  authMiddleware,
  requireRole("admin", "client_operator", "warehouse_operator"),
  getClients,
);

router.get(
  "/:id",
  authMiddleware,
  requireRole("admin", "client_operator", "warehouse_operator"),
  getClientById,
);

router.put("/:id", authMiddleware, requireRole("admin"), updateClient);

export default router;

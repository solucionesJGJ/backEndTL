import { Router } from "express";
import { getMovementStatuses } from "../controllers/movement-status.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { requireRole } from "../middlewares/role.middleware.js";

const router = Router();

router.get(
    "/",
    authMiddleware,
    requireRole("admin", "warehouse_operator", "client_operator"),
    getMovementStatuses
);

export default router;
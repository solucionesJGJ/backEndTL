import { Router } from "express";
import { requireRole } from "../middlewares/role.middleware.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { getClientDashboard, getPlantDashboard } from "../controllers/dashboard.controller.js";


const router = Router();

router.get(
    '/plant',
    authMiddleware,
    requireRole('admin', 'warehouse_operator'),
    getPlantDashboard,
)

router.get(
    "/client",
    authMiddleware,
    requireRole("admin", "client_operator"),
    getClientDashboard
);

export default router;
import { Router } from "express";
import { requireRole } from "../middlewares/role.middleware.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { getPlantDashboard } from "../controllers/dashboard.controller.js";


const router = Router();

router.get(
    '/plant',
    authMiddleware,
    requireRole('admin', 'warehouse_operator'),
    getPlantDashboard,
)

export default router;
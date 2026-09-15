import { Router } from "express";

import { getEconomicActivities } from "../controllers/economic-activity.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { requireRole } from "../middlewares/role.middleware.js";

const router = Router();

router.get(
    "/",
    authMiddleware,
    requireRole("admin", "client_operator", "warehouse_operator"),
    getEconomicActivities,
);

export default router;
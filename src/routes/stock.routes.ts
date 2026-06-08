import { Router } from "express";
import { getStock } from "../controllers/stock.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { requireRole } from "../middlewares/role.middleware.js";

const router = Router();

router.get(
    "/",
    authMiddleware,
    requireRole("admin", "warehouse_operator"),
    getStock
);

export default router;
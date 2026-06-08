import { Router } from "express";
import {
    createGarment,
    deactivateGarment,
    getGarmentById,
    getGarments,
    updateGarment,
} from "../controllers/garment.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { requireRole } from "../middlewares/role.middleware.js";

const router = Router();

router.get("/", authMiddleware, requireRole("admin", "warehouse_operator", "client_operator"), getGarments);
router.get("/:id", authMiddleware, requireRole("admin", "warehouse_operator", "client_operator"), getGarmentById);
router.post("/", authMiddleware, requireRole("admin"), createGarment);
router.put("/:id", authMiddleware, requireRole("admin"), updateGarment);
router.patch("/:id/deactivate", authMiddleware, requireRole("admin"), deactivateGarment);

export default router;
import { Router } from "express";
import {
    createGarmentProcess,
    deactivateGarmentProcess,
    getGarmentProcesses,
    updateGarmentProcess,
} from "../controllers/garment-process.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { requireRole } from "../middlewares/role.middleware.js";

const router = Router();

router.get(
    "/",
    authMiddleware,
    requireRole("admin", "warehouse_operator", "client_operator"),
    getGarmentProcesses
);

router.post(
    "/",
    authMiddleware,
    requireRole("admin"),
    createGarmentProcess
);

router.put(
    "/:id",
    authMiddleware,
    requireRole("admin"),
    updateGarmentProcess
);

router.patch(
    "/:id/deactivate",
    authMiddleware,
    requireRole("admin"),
    deactivateGarmentProcess
);

export default router;
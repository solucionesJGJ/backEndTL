import { Router } from "express";
import {
    createGarmentType,
    deactivateGarmentType,
    deleteGarmentType,
    getGarmentTypeById,
    getGarmentTypes,
    updateGarmentType,
} from "../controllers/garment-type.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { requireRole } from "../middlewares/role.middleware.js";

const router = Router();

router.get(
    "/",
    authMiddleware,
    requireRole("admin", "operator"),
    getGarmentTypes
);

router.get(
    "/:id",
    authMiddleware,
    requireRole("admin", "operator"),
    getGarmentTypeById
);

router.post(
    "/",
    authMiddleware,
    requireRole("admin"),
    createGarmentType
);

router.put(
    "/:id",
    authMiddleware,
    requireRole("admin"),
    updateGarmentType
);

router.delete(
    "/:id",
    authMiddleware,
    requireRole("admin"),
    deleteGarmentType
);

router.patch(
    "/:id/deactivate",
    authMiddleware,
    requireRole("admin"),
    deactivateGarmentType
);

export default router;
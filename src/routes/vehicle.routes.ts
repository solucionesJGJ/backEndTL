import {
    Router,
} from "express";

import {
    createVehicle,
    deactivateVehicle,
    getActiveVehicles,
    getVehicles,
    updateVehicle,
} from "../controllers/vehicle.controller.js";

import {
    authMiddleware,
} from "../middlewares/auth.middleware.js";

import {
    requireRole,
} from "../middlewares/role.middleware.js";


const router =
    Router();


router.use(
    authMiddleware,
);


/**
 * Transportista puede consultar
 * vehículos activos.
 */
router.get(
    "/active",
    requireRole(
        "admin",
        "transportista",
    ),
    getActiveVehicles,
);


/**
 * Administración de vehículos.
 */
router.get(
    "/",
    requireRole(
        "admin",
    ),
    getVehicles,
);


router.post(
    "/",
    requireRole(
        "admin",
    ),
    createVehicle,
);


router.put(
    "/:id",
    requireRole(
        "admin",
    ),
    updateVehicle,
);


router.patch(
    "/:id/deactivate",
    requireRole(
        "admin",
    ),
    deactivateVehicle,
);


export default router;
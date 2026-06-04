import { Router } from "express";
import { createClient, getClients, getClientById, updateClient } from "../controllers/client.controller.js";
import { requireRole } from "../middlewares/role.middleware.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";

const router = Router();

router.post(
    "/",
    authMiddleware,
    requireRole("admin"),
    createClient
);
router.get(
    "/",
    authMiddleware,
    requireRole("admin", "operator"),
    getClients
);

router.get(
    "/:id",
    authMiddleware,
    requireRole("admin", "operator"),
    getClientById
);

router.put(
    "/:id",
    authMiddleware,
    requireRole("admin"),
    updateClient
);

export default router;
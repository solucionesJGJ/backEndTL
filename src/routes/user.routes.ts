import { Router } from "express";
import {
    createUser,
    deactivateUser,
    getUsers,
    updateUser,
} from "../controllers/user.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { requireRole } from "../middlewares/role.middleware.js";

const router = Router();

router.get("/", authMiddleware, requireRole("admin"), getUsers);
router.post("/", authMiddleware, requireRole("admin"), createUser);
router.put("/:id", authMiddleware, requireRole("admin"), updateUser);
router.patch("/:id/deactivate", authMiddleware, requireRole("admin"), deactivateUser);

export default router;
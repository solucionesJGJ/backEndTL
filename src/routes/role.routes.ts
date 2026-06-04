import { Router } from "express";
import { getRoles } from "../controllers/role.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { requireRole } from "../middlewares/role.middleware.js";

const router = Router();

router.get("/", authMiddleware, requireRole("admin"), getRoles);

export default router;
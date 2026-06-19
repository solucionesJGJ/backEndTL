import { Router } from "express";
import { bootstrapAdmin, login } from "../controllers/auth.controller.js";

const router = Router();

router.post("/bootstrap-admin", bootstrapAdmin);
router.post("/login", login);

export default router;

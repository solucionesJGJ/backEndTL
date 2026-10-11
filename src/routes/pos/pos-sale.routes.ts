import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { requireRole } from "../../middlewares/role.middleware.js";
import {
  postSale,
  getSaleById,
  getSales,
} from "../../controllers/pos/pos-sale.controller.js";
const router = Router();
router.use(authMiddleware, requireRole("admin"));
router.post("/sales", postSale);
router.get("/sales", getSales);
router.get("/sales/:id", getSaleById);
export default router;

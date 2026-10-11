import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { requireRole } from "../../middlewares/role.middleware.js";
import { postSaleReversal, getSaleReversalBySale, getSaleReversals } from "../../controllers/pos/pos-sale-reversal.controller.js";

const router = Router();
router.use(authMiddleware, requireRole("admin"));
router.post("/sales/:id/reversal", postSaleReversal);
router.get("/sales/:id/reversal", getSaleReversalBySale);
router.get("/sale-reversals", getSaleReversals);
export default router;

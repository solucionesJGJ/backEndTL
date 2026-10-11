import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { requireRole } from "../../middlewares/role.middleware.js";
import {
  getLocationPrices,
  getEffectiveItemPrice,
  putLocationPrice,
  patchLocationPrice,
} from "../../controllers/pos/pos-location-price.controller.js";
const router = Router();
router.use(authMiddleware, requireRole("admin"));
router.get("/locations/:locationId/prices", getLocationPrices);
router.get(
  "/locations/:locationId/prices/effective/:itemId",
  getEffectiveItemPrice,
);
router.put("/location-prices", putLocationPrice);
router.patch("/location-prices/:id", patchLocationPrice);
export default router;

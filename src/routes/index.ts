import { Router } from "express";

import authRoutes from "./auth.routes.js";
import billingRoutes from "./billing.routes.js";
import clientReportRoutes from "./client-report.routes.js";
import clientRoutes from "./client.routes.js";
import dashboardRoutes from "./dashboard.routes.js";
import dispatchGuideRoutes from "./dispatch-guide.routes.js";
import driverShiftRoutes from "./driver-shift.routes.js";
import garmentRoutes from "./garment.routes.js";
import movementStatusRoutes from "./movement-status.routes.js";
import operatorBatchRoutes from "./operator-batch.routes.js";
import roleRoutes from "./role.routes.js";
import stockRoutes from "./stock.routes.js";
import userRoutes from "./user.routes.js";
import vehicleRoutes from "./vehicle.routes.js";
import economicActivityRoutes from "./economic-activity.routes.js";
import posConfigRoutes from "./pos/pos-config.routes.js";
import posResourcesRoutes from "./pos/pos-resources.routes.js";
import posCatalogRoutes from "./pos/pos-catalog.routes.js";
import posLocationPriceRoutes from "./pos/pos-location-price.routes.js";
import posSaleRoutes from "./pos/pos-sale.routes.js";
import posSaleReversalRoutes from "./pos/pos-sale-reversal.routes.js";

const router = Router();

router.use("/auth", authRoutes);
router.use("/clients", clientRoutes);
router.use("/economic-activities", economicActivityRoutes);
router.use("/garments", garmentRoutes);
router.use("/users", userRoutes);
router.use("/roles", roleRoutes);
router.use("/operator", operatorBatchRoutes);
router.use("/movement-statuses", movementStatusRoutes);
router.use("/stock", stockRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/vehicles", vehicleRoutes);
router.use("/driver-shifts", driverShiftRoutes);
router.use("/reports", clientReportRoutes);
router.use("/billing", billingRoutes);
router.use("/dispatch-guides", dispatchGuideRoutes);
router.use("/pos", posConfigRoutes);
router.use("/pos", posResourcesRoutes);
router.use("/pos", posCatalogRoutes);
router.use("/pos", posLocationPriceRoutes);
router.use("/pos",posSaleRoutes);
router.use("/pos", posSaleReversalRoutes);

export default router;

import { Router } from "express";

import authRoutes from "./auth.routes.js";
import clientRoutes from "./client.routes.js";
import garmentRoutes from "./garment.routes.js";
import userRoutes from "./user.routes.js";
import roleRoutes from "./role.routes.js";
import operatorBatchRoutes from "./operator-batch.routes.js";
import movementStatusRoutes from "./movement-status.routes.js";
import stockRoutes from "./stock.routes.js";
import dashboardRoutes from "./dashboard.routes.js";
import vehicleRoutes from "./vehicle.routes.js";
import driverShiftRoutes from "./driver-shift.routes.js";

const router = Router();

router.use("/auth", authRoutes);
router.use("/clients", clientRoutes);
router.use("/garments", garmentRoutes);
router.use("/users", userRoutes);
router.use("/roles", roleRoutes);
router.use("/operator", operatorBatchRoutes);
router.use("/movement-statuses", movementStatusRoutes);
router.use("/stock", stockRoutes);
router.use("/dashboard", dashboardRoutes);
router.use(
    "/vehicles",
    vehicleRoutes,
);

router.use(
    "/driver-shifts",
    driverShiftRoutes,
);

export default router;
import { Router } from "express";

import authRoutes from "./auth.routes.js";
import clientRoutes from "./client.routes.js";
import garmentRoutes from "./garment.routes.js";
import userRoutes from "./user.routes.js";
import garmentTypeRoutes from "./garment-type.routes.js";
import roleRoutes from "./role.routes.js";
import operatorBatchRoutes from "./operator-batch.routes.js";
import movementStatusRoutes from "./movement-status.routes.js";

const router = Router();

router.use("/auth", authRoutes);
router.use("/clients", clientRoutes);
router.use("/garments", garmentRoutes);
router.use("/users", userRoutes);
router.use("/garment-types", garmentTypeRoutes);
router.use("/roles", roleRoutes);
router.use("/operator", operatorBatchRoutes);
router.use("/movement-statuses", movementStatusRoutes);

export default router;
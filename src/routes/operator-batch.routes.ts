import { Router } from "express";
import {
    createOperatorBatch,
    getOperatorBatchById,
    getOperatorBatches,
} from "../controllers/operator-batch.controller.js";
import {
    addBatchItem,
    getBatchItems,
    removeBatchItem,
    updateBatchItem,
} from "../controllers/operator-batch-item.controller.js";
import {
    createBatchMovement,
    getBatchMovements,
} from "../controllers/operator-movement.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { requireRole } from "../middlewares/role.middleware.js";

const router = Router();

router.use(authMiddleware);
router.use(requireRole("admin", "operator"));

router.get("/batches", getOperatorBatches);
router.get("/batches/:id", getOperatorBatchById);
router.post("/batches", createOperatorBatch);

router.get("/batches/:batchId/items", getBatchItems);
router.post("/batches/:batchId/items", addBatchItem);
router.put("/batches/:batchId/items/:itemId", updateBatchItem);
router.delete("/batches/:batchId/items/:itemId", removeBatchItem);

router.get("/batches/:batchId/movements", getBatchMovements);
router.post("/batches/:batchId/movements", createBatchMovement);

export default router;
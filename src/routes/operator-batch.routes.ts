import { Router } from "express";

import {
    changeOperatorBatchStatus,
    createOperatorBatch,
    evaluateOperatorBatch,
    getOperatorBatchById,
    getOperatorBatches,
    receiveOperatorBatch,
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

/**
 * Ver lotes
 */
router.get(
    "/batches",
    requireRole("admin", "client_operator", "warehouse_operator"),
    getOperatorBatches
);

router.get(
    "/batches/:id",
    requireRole("admin", "client_operator", "warehouse_operator"),
    getOperatorBatchById
);

/**
 * Crear lote
 * Solo cliente y admin
 */
router.post(
    "/batches",
    requireRole("admin", "client_operator"),
    createOperatorBatch
);

/**
 * Agregar / editar prendas del lote
 * Solo cliente y admin
 */
router.get(
    "/batches/:batchId/items",
    requireRole("admin", "client_operator", "warehouse_operator"),
    getBatchItems
);

router.post(
    "/batches/:batchId/items",
    requireRole("admin", "client_operator"),
    addBatchItem
);

router.put(
    "/batches/:batchId/items/:itemId",
    requireRole("admin", "client_operator"),
    updateBatchItem
);

router.delete(
    "/batches/:batchId/items/:itemId",
    requireRole("admin", "client_operator"),
    removeBatchItem
);

/**
 * Recepción / evaluación / cambio de estado
 * Solo planta y admin
 */
router.patch(
    "/batches/:id/receive",
    requireRole("admin", "warehouse_operator"),
    receiveOperatorBatch
);

router.patch(
    "/batches/:id/evaluate",
    requireRole("admin", "warehouse_operator"),
    evaluateOperatorBatch
);

router.patch(
    "/batches/:id/change-status",
    requireRole("admin", "warehouse_operator"),
    changeOperatorBatchStatus
);

/**
 * Movimientos de inventario
 * Solo planta y admin
 */
router.get(
    "/batches/:batchId/movements",
    requireRole("admin", "warehouse_operator", "client_operator"),
    getBatchMovements
);

router.post(
    "/batches/:batchId/movements",
    requireRole("admin", "warehouse_operator"),
    createBatchMovement
);

export default router;
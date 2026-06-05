import type { Request, Response } from "express";
import {
    Garment,
    GarmentBatch,
    GarmentBatchItem,
    GarmentType,
} from "../models/index.js";

export async function getBatchItems(req: Request, res: Response) {
    try {
        const { batchId } = req.params;

        const batch = await GarmentBatch.findByPk(batchId);

        if (!batch) {
            return res.status(404).json({
                ok: false,
                message: "Lote no encontrado",
            });
        }

        const items = await GarmentBatchItem.findAll({
            where: {
                batch_id: batchId,
            },
            include: [
                {
                    model: Garment,
                    as: "garment",
                    include: [
                        {
                            model: GarmentType,
                            as: "type",
                            attributes: ["id", "name"],
                        },
                    ],
                },
            ],
            order: [["createdAt", "DESC"]],
        });

        return res.json({
            ok: true,
            data: items,
        });
    } catch (error) {
        console.error(error);

        return res.status(500).json({
            ok: false,
            message: "Error obteniendo prendas del lote",
        });
    }
}

export async function addBatchItem(req: Request, res: Response) {
    try {
        const { batchId } = req.params;

        const {
            garment_id,
            quantity_sent,
            quantity_received,
            notes,
        } = req.body;

        if (!garment_id) {
            return res.status(400).json({
                ok: false,
                message: "garment_id es obligatorio",
            });
        }

        if (!quantity_sent || quantity_sent <= 0) {
            return res.status(400).json({
                ok: false,
                message: "quantity_sent debe ser mayor a 0",
            });
        }

        const batch = await GarmentBatch.findByPk(batchId);

        if (!batch) {
            return res.status(404).json({
                ok: false,
                message: "Lote no encontrado",
            });
        }

        const garment = await Garment.findByPk(garment_id);

        if (!garment) {
            return res.status(404).json({
                ok: false,
                message: "Prenda no encontrada",
            });
        }

        if (garment.client_id !== batch.client_id) {
            return res.status(400).json({
                ok: false,
                message: "La prenda no pertenece al cliente del lote",
            });
        }

        const existingItem = await GarmentBatchItem.findOne({
            where: {
                batch_id: batchId,
                garment_id,
            },
        });

        if (existingItem) {
            return res.status(409).json({
                ok: false,
                message: "La prenda ya existe en este lote",
            });
        }

        const item = await GarmentBatchItem.create({
            batch_id: batchId,
            garment_id,
            quantity_sent,
            quantity_received: quantity_received || 0,
            quantity_processed: 0,
            quantity_reprocessed: 0,
            quantity_returned: 0,
            notes: notes || null,
        });

        return res.status(201).json({
            ok: true,
            message: "Prenda agregada al lote correctamente",
            data: item,
        });
    } catch (error) {
        console.error(error);

        return res.status(500).json({
            ok: false,
            message: "Error agregando prenda al lote",
        });
    }
}

export async function updateBatchItem(req: Request, res: Response) {
    try {
        const { batchId, itemId } = req.params;

        const {
            quantity_sent,
            quantity_received,
            quantity_processed,
            quantity_reprocessed,
            quantity_returned,
            notes,
        } = req.body;

        const item = await GarmentBatchItem.findOne({
            where: {
                id: itemId,
                batch_id: batchId,
            },
        });

        if (!item) {
            return res.status(404).json({
                ok: false,
                message: "Prenda del lote no encontrada",
            });
        }

        await item.update({
            quantity_sent:
                typeof quantity_sent === "number" ? quantity_sent : item.quantity_sent,
            quantity_received:
                typeof quantity_received === "number"
                    ? quantity_received
                    : item.quantity_received,
            quantity_processed:
                typeof quantity_processed === "number"
                    ? quantity_processed
                    : item.quantity_processed,
            quantity_reprocessed:
                typeof quantity_reprocessed === "number"
                    ? quantity_reprocessed
                    : item.quantity_reprocessed,
            quantity_returned:
                typeof quantity_returned === "number"
                    ? quantity_returned
                    : item.quantity_returned,
            notes: notes ?? item.notes,
        });

        return res.json({
            ok: true,
            message: "Prenda del lote actualizada correctamente",
            data: item,
        });
    } catch (error) {
        console.error(error);

        return res.status(500).json({
            ok: false,
            message: "Error actualizando prenda del lote",
        });
    }
}

export async function removeBatchItem(req: Request, res: Response) {
    try {
        const { batchId, itemId } = req.params;

        const item = await GarmentBatchItem.findOne({
            where: {
                id: itemId,
                batch_id: batchId,
            },
        });

        if (!item) {
            return res.status(404).json({
                ok: false,
                message: "Prenda del lote no encontrada",
            });
        }

        await item.destroy();

        return res.json({
            ok: true,
            message: "Prenda eliminada del lote correctamente",
        });
    } catch (error) {
        console.error(error);

        return res.status(500).json({
            ok: false,
            message: "Error eliminando prenda del lote",
        });
    }
}
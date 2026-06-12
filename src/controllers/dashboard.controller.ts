import type { Request, Response } from "express";
import { col, fn } from "sequelize";
import {
    Client,
    GarmentBatch,
    GarmentBatchItem,
    MovementStatus,
} from "../models/index.js";

export async function getPlantDashboard(req: Request, res: Response) {
    try {
        const statusSummary = await GarmentBatch.findAll({
            attributes: [
                "current_status_id",
                [fn("COUNT", col("GarmentBatch.id")), "total"],
            ],
            include: [
                {
                    model: MovementStatus,
                    as: "current_status",
                    attributes: ["id", "code", "name", "sort_order"],
                },
            ],
            group: [
                "GarmentBatch.current_status_id",
                "current_status.id",
                "current_status.code",
                "current_status.name",
                "current_status.sort_order",
            ],
            order: [[{ model: MovementStatus, as: "current_status" }, "sort_order", "ASC"]],
        });

        const estimatedRevenue = await GarmentBatchItem.sum("calculated_total");

        const recentBatches = await GarmentBatch.findAll({
            limit: 10,
            order: [["createdAt", "DESC"]],
            include: [
                {
                    model: Client,
                    as: "client",
                    attributes: ["id", "name", "rut"],
                },
                {
                    model: MovementStatus,
                    as: "current_status",
                    attributes: ["id", "code", "name"],
                },
            ],
        });

        const totalBatches = await GarmentBatch.count();

        return res.json({
            ok: true,
            data: {
                totalBatches,
                estimatedRevenue: Number(estimatedRevenue || 0),
                statusSummary,
                recentBatches,
            },
        });
    } catch (error) {
        console.error(error);

        return res.status(500).json({
            ok: false,
            message: "Error obteniendo dashboard de planta",
        });
    }
}
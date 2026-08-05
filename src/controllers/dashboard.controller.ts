import type { Request, Response } from "express";
import { col, fn, Op } from "sequelize";
import {
    Client,
    GarmentBatch,
    GarmentBatchItem,
    MovementStatus,
} from "../models/index.js";
import { isNonEmptyString } from "../utils/validators.js";

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

export async function getClientDashboard(req: Request, res: Response) {
    try {
        const user = req.user;
        const roleName = user?.role?.name;

        const queryClientId = req.query.client_id;
        let clientId = isNonEmptyString(queryClientId) ? queryClientId : undefined;

        if (queryClientId !== undefined && queryClientId !== null && queryClientId !== "" && !isNonEmptyString(queryClientId)) {
            return res.status(400).json({
                ok: false,
                message: "client_id debe ser un identificador valido",
            });
        }

        if (roleName === "client_operator") {
            clientId = user?.client_id || undefined;
        }

        if (!clientId) {
            return res.status(400).json({
                ok: false,
                message: "client_id es obligatorio",
            });
        }

        const client = await Client.findByPk(clientId);

        if (!client) {
            return res.status(404).json({
                ok: false,
                message: "Cliente no encontrado",
            });
        }

        const totalBatches = await GarmentBatch.count({
            where: { client_id: clientId },
        });

        const openBatches = await GarmentBatch.count({
            where: {
                client_id: clientId,
                closed_at: null,
            },
        });

        const closedBatches = await GarmentBatch.count({
            where: {
                client_id: clientId,
                closed_at: {
                    [Op.ne]: null,
                },
            },
        });

        const statusSummary = await GarmentBatch.findAll({
            attributes: [
                "current_status_id",
                [fn("COUNT", col("GarmentBatch.id")), "total"],
            ],
            where: {
                client_id: clientId,
            },
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
            order: [
                [
                    { model: MovementStatus, as: "current_status" },
                    "sort_order",
                    "ASC",
                ],
            ],
        });

        const estimatedTotalResult = await GarmentBatchItem.findOne({
            attributes: [[fn("SUM", col("calculated_total")), "estimatedTotal"]],
            include: [
                {
                    model: GarmentBatch,
                    as: "batch",
                    attributes: [],
                    where: {
                        client_id: clientId,
                    },
                },
            ],
            raw: true,
        });

        const estimatedTotal = Number((estimatedTotalResult as any)?.estimatedTotal || 0);

        const batches = await GarmentBatch.findAll({
            where: {
                client_id: clientId,
            },
            include: [
                {
                    model: Client,
                    as: "client",
                    attributes: ["id", "name", "rut"],
                },
                {
                    model: MovementStatus,
                    as: "current_status",
                    attributes: ["id", "code", "name", "sort_order"],
                },
            ],
            order: [["createdAt", "DESC"]],
        });

        return res.json({
            ok: true,
            data: {
                client,
                totalBatches,
                openBatches,
                closedBatches,
                estimatedTotal: Number(estimatedTotal || 0),
                statusSummary,
                batches,
            },
        });
    } catch (error) {
        console.error(error);

        return res.status(500).json({
            ok: false,
            message: "Error obteniendo dashboard cliente",
        });
    }
}

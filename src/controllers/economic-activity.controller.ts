import type { Request, Response } from "express";
import { Op } from "sequelize";

import { EconomicActivity } from "../models/index.js";

export async function getEconomicActivities(req: Request, res: Response) {
    try {
        const search =
            typeof req.query.search === "string" ? req.query.search.trim() : "";

        const limitValue =
            typeof req.query.limit === "string"
                ? Number.parseInt(req.query.limit, 10)
                : 50;

        const limit = Number.isFinite(limitValue)
            ? Math.min(Math.max(limitValue, 1), 100)
            : 50;

        const where = search
            ? {
                active: true,
                [Op.or]: [
                    {
                        code: {
                            [Op.iLike]: `%${search}%`,
                        },
                    },
                    {
                        description: {
                            [Op.iLike]: `%${search}%`,
                        },
                    },
                ],
            }
            : {
                active: true,
            };

        const activities = await EconomicActivity.findAll({
            where,
            order: [
                ["code", "ASC"],
                ["description", "ASC"],
            ],
            limit,
        });

        return res.json({
            ok: true,
            data: activities,
        });
    } catch (error) {
        console.error(error);

        return res.status(500).json({
            ok: false,
            message: "Error obteniendo actividades económicas",
        });
    }
}
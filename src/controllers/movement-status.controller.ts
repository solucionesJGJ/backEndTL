import type { Request, Response } from "express";
import { MovementStatus } from "../models/index.js";

export async function getMovementStatuses(req: Request, res: Response) {
    try {
        const statuses = await MovementStatus.findAll({
            order: [["sort_order", "ASC"]],
        });

        return res.json({
            ok: true,
            data: statuses,
        });
    } catch (error) {
        console.error(error);

        return res.status(500).json({
            ok: false,
            message: "Error obteniendo estados de movimiento",
        });
    }
}
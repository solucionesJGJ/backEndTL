import type { Request, Response } from "express";
import {
    Client,
    Garment,
    GarmentStock,
    GarmentType,
    MovementStatus,
} from "../models/index.js";

export async function getStock(req: Request, res: Response) {
    try {
        const { client_id, status_id, garment_id } = req.query;

        const where: any = {};

        if (client_id) where.client_id = client_id;
        if (status_id) where.status_id = status_id;
        if (garment_id) where.garment_id = garment_id;

        const stock = await GarmentStock.findAll({
            where,
            include: [
                {
                    model: Client,
                    as: "client",
                    attributes: ["id", "name", "rut"],
                },
                {
                    model: Garment,
                    as: "garment",
                    attributes: [
                        "id",
                        "code",
                        "description",
                        "size",
                        "color",
                        "barcode",
                    ],
                    include: [
                        {
                            model: GarmentType,
                            as: "type",
                            attributes: ["id", "name"],
                        },
                    ],
                },
                {
                    model: MovementStatus,
                    as: "status",
                    attributes: ["id", "code", "name", "sort_order"],
                },
            ],
            order: [
                [{ model: Client, as: "client" }, "name", "ASC"],
                [{ model: MovementStatus, as: "status" }, "sort_order", "ASC"],
            ],
        });

        return res.json({
            ok: true,
            data: stock,
        });
    } catch (error) {
        console.error(error);

        return res.status(500).json({
            ok: false,
            message: "Error obteniendo stock",
        });
    }
}
import type { Request, Response } from "express";
import {
    Client,
    Garment,
    GarmentStock,
    GarmentType,
    MovementStatus,
} from "../models/index.js";
import { isNonEmptyString } from "../utils/validators.js";

function assertOptionalQueryId(value: unknown, fieldName: string) {
    if (value === undefined || value === null || value === "") return null;
    if (!isNonEmptyString(value)) {
        return `${fieldName} debe ser un identificador valido`;
    }
    return null;
}

export async function getStock(req: Request, res: Response) {
    try {
        const { client_id, status_id, garment_id } = req.query;

        const validationError =
            assertOptionalQueryId(client_id, "client_id") ||
            assertOptionalQueryId(status_id, "status_id") ||
            assertOptionalQueryId(garment_id, "garment_id");

        if (validationError) {
            return res.status(400).json({
                ok: false,
                message: validationError,
            });
        }

        const where: any = {};

        if (isNonEmptyString(client_id)) where.client_id = client_id;
        if (isNonEmptyString(status_id)) where.status_id = status_id;
        if (isNonEmptyString(garment_id)) where.garment_id = garment_id;

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

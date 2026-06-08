import type { Request, Response } from "express";
import {
    Client,
    GarmentBatch,
    MovementStatus,
    User,
} from "../models/index.js";
import {
    isAdmin,
    isClientOperator,
} from "../helpers/auth.helper.js";

export async function getOperatorBatches(req: Request, res: Response) {
    try {
        const where: any = {};

        if (req.user?.role?.name === "client_operator") {
            where.client_id = req.user.client_id;
        }
        const batches = await GarmentBatch.findAll({
            where,
            include: [
                { model: Client, as: "client", attributes: ["id", "name", "rut"] },
                { model: User, as: "creator", attributes: ["id", "name", "email"] },
                {
                    model: MovementStatus,
                    as: "current_status",
                    attributes: ["id", "code", "name"],
                },
            ],
            order: [["createdAt", "DESC"]],
        });

        return res.json({
            ok: true,
            data: batches,
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            ok: false,
            message: "Error obteniendo lotes",
        });
    }
}

export async function getOperatorBatchById(req: Request, res: Response) {
    try {
        const { id } = req.params;

        const batch = await GarmentBatch.findByPk(id, {
            include: [
                { model: Client, as: "client", attributes: ["id", "name", "rut"] },
                { model: User, as: "creator", attributes: ["id", "name", "email"] },
                {
                    model: MovementStatus,
                    as: "current_status",
                    attributes: ["id", "code", "name"],
                },
            ],
        });

        if (!batch) {
            return res.status(404).json({
                ok: false,
                message: "Lote no encontrado",
            });
        }

        return res.json({
            ok: true,
            data: batch,
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            ok: false,
            message: "Error obteniendo lote",
        });
    }
}

export async function createOperatorBatch(req: Request, res: Response) {
    try {
        const {
            client_id,
            batch_number,
            origin_location,
            destination_location,
            notes,
        } = req.body;

        const user = req.user;

        if (!user) {
            return res.status(401).json({
                ok: false,
                message: "Usuario no autenticado",
            });
        }

        const roleName = user.role?.name;

        if (!batch_number?.trim()) {
            return res.status(400).json({
                ok: false,
                message: "batch_number es obligatorio",
            });
        }

        let finalClientId: string | null = null;

        if (roleName === "client_operator") {
            if (!user.client_id) {
                return res.status(403).json({
                    ok: false,
                    message: "El operario cliente no tiene cliente asociado",
                });
            }

            finalClientId = user.client_id;
        }

        if (roleName === "admin") {
            if (!client_id) {
                return res.status(400).json({
                    ok: false,
                    message: "client_id es obligatorio para administrador",
                });
            }

            finalClientId = client_id;
        }

        if (roleName !== "admin" && roleName !== "client_operator") {
            return res.status(403).json({
                ok: false,
                message: "No tienes permisos para crear lotes",
            });
        }

        const client = await Client.findByPk(finalClientId || '');

        if (!client) {
            return res.status(404).json({
                ok: false,
                message: "Cliente no encontrado",
            });
        }

        const existingBatch = await GarmentBatch.findOne({
            where: {
                batch_number: batch_number.trim(),
            },
        });

        if (existingBatch) {
            return res.status(409).json({
                ok: false,
                message: "Ya existe un lote con ese número",
            });
        }

        const initialStatus = await MovementStatus.findOne({
            where: {
                code: "ENTRADA_PLANTA",
            },
        });

        if (!initialStatus) {
            return res.status(500).json({
                ok: false,
                message: "No existe estado inicial ENTRADA_PLANTA",
            });
        }

        const batch = await GarmentBatch.create({
            client_id: finalClientId || '',
            batch_number: batch_number.trim(),
            created_by: user.id,
            origin_location: origin_location || null,
            destination_location: destination_location || null,
            current_status_id: initialStatus.id,
            received_at: new Date(),
            notes: notes || null,
        });

        return res.status(201).json({
            ok: true,
            message: "Lote creado correctamente",
            data: batch,
        });
    } catch (error) {
        console.error(error);

        return res.status(500).json({
            ok: false,
            message: "Error creando lote",
        });
    }
}
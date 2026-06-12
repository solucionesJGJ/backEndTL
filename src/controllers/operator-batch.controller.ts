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

const allowedTransitions: Record<string, string[]> = {
    EN_PROCESO: ['REPROCESO', 'PREPARADO_DESPACHO'],
    REPROCESO: ['EN_PROCESO', 'PREPARADO_DESPACHO'],
    DERIVADO_EXTERNO: ['EN_TRASLADO'],
    PREPARADO_DESPACHO: ['EN_TRASLADO'],
    EN_TRASLADO: ['RETORNADO_CLIENTE'],
    RETORNADO_CLIENTE: ['CERRADO'],
}

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
                code: "PENDIENTE_RECEPCION",
            },
        });

        if (!initialStatus) {
            return res.status(500).json({
                ok: false,
                message: "No existe estado inicial PENDIENTE_RECEPCION",
            });
        }

        const batch = await GarmentBatch.create({
            client_id: finalClientId || '',
            batch_number: batch_number.trim(),
            created_by: user.id,
            origin_location: origin_location || "Cliente",
            destination_location: destination_location || "Planta Central",
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

export async function receiveOperatorBatch(req: Request, res: Response) {
    try {
        const { id } = req.params;
        const { notes } = req.body;

        const batch = await GarmentBatch.findByPk(id, {
            include: [
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

        const batchJson = batch.toJSON() as any;

        if (batchJson.current_status?.code !== "PENDIENTE_RECEPCION") {
            return res.status(400).json({
                ok: false,
                message: "Solo se pueden recepcionar lotes en estado Pendiente Recepción",
            });
        }

        const receivedStatus = await MovementStatus.findOne({
            where: {
                code: "RECEPCIONADO",
            },
        });

        if (!receivedStatus) {
            return res.status(500).json({
                ok: false,
                message: "No existe estado RECEPCIONADO",
            });
        }

        await batch.update({
            current_status_id: receivedStatus.id,
            received_at: new Date(),
            notes: notes ? `${batch.notes || ""}\nRecepción: ${notes}` : batch.notes,
        });

        return res.json({
            ok: true,
            message: "Lote recepcionado correctamente",
            data: batch,
        });
    } catch (error) {
        console.error(error);

        return res.status(500).json({
            ok: false,
            message: "Error recepcionando lote",
        });
    }
}

export async function evaluateOperatorBatch(req: Request, res: Response) {
    try {
        const { id } = req.params;
        const { can_process, notes } = req.body;

        if (typeof can_process !== "boolean") {
            return res.status(400).json({
                ok: false,
                message: "can_process debe ser boolean",
            });
        }

        const batch = await GarmentBatch.findByPk(id, {
            include: [
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

        const batchJson = batch.toJSON() as any;

        if (batchJson.current_status?.code !== "RECEPCIONADO") {
            return res.status(400).json({
                ok: false,
                message: "Solo se pueden evaluar lotes en estado Recepcionado",
            });
        }

        const nextStatusCode = can_process ? "EN_PROCESO" : "DERIVADO_EXTERNO";

        const nextStatus = await MovementStatus.findOne({
            where: {
                code: nextStatusCode,
            },
        });

        if (!nextStatus) {
            return res.status(500).json({
                ok: false,
                message: `No existe estado ${nextStatusCode}`,
            });
        }

        const evaluationNote = can_process
            ? "Evaluación: lote enviado a proceso interno"
            : "Evaluación: lote derivado a proceso externo";

        await batch.update({
            current_status_id: nextStatus.id,
            notes: [
                batch.notes,
                evaluationNote,
                notes ? `Observación: ${notes}` : null,
            ]
                .filter(Boolean)
                .join("\n"),
        });

        return res.json({
            ok: true,
            message: can_process
                ? "Lote enviado a proceso correctamente"
                : "Lote derivado externamente correctamente",
            data: batch,
        });
    } catch (error) {
        console.error(error);

        return res.status(500).json({
            ok: false,
            message: "Error evaluando lote",
        });
    }
}

export async function changeOperatorBatchStatus(req: Request, res: Response) {
    try {
        const { id } = req.params
        const { next_status_code, notes } = req.body

        if (!next_status_code) {
            return res.status(400).json({
                ok: false,
                message: 'next_status_code es obligatorio',
            })
        }

        const batch = await GarmentBatch.findByPk(id, {
            include: [
                {
                    model: MovementStatus,
                    as: 'current_status',
                    attributes: ['id', 'code', 'name'],
                },
            ],
        })

        if (!batch) {
            return res.status(404).json({
                ok: false,
                message: 'Lote no encontrado',
            })
        }

        const batchJson = batch.toJSON() as any
        const currentCode = batchJson.current_status?.code

        const allowedNextStatuses = allowedTransitions[currentCode] || []

        if (!allowedNextStatuses.includes(next_status_code)) {
            return res.status(400).json({
                ok: false,
                message: `No se permite cambiar de ${currentCode} a ${next_status_code}`,
            })
        }

        const nextStatus = await MovementStatus.findOne({
            where: {
                code: next_status_code,
            },
        })

        if (!nextStatus) {
            return res.status(404).json({
                ok: false,
                message: 'Estado destino no encontrado',
            })
        }

        const statusNote = `Cambio de estado: ${currentCode} → ${next_status_code}`

        await batch.update({
            current_status_id: nextStatus.id,
            closed_at: next_status_code === 'CERRADO' ? new Date() : batch.closed_at,
            notes: [batch.notes, statusNote, notes ? `Observación: ${notes}` : null]
                .filter(Boolean)
                .join('\n'),
        })

        return res.json({
            ok: true,
            message: 'Estado del lote actualizado correctamente',
            data: batch,
        })
    } catch (error) {
        console.error(error)

        return res.status(500).json({
            ok: false,
            message: 'Error actualizando estado del lote',
        })
    }
}
import type { Request, Response } from "express";
import {
    Client,
    GarmentBatch,
    GarmentBatchItem,
    GarmentMovement,
    GarmentStock,
    MovementStatus,
    sequelize,
    User,
} from "../models/index.js";
import {
    isAdmin,
    isClientOperator,
} from "../helpers/auth.helper.js";
import { Op } from "sequelize";
import { isNonEmptyString } from "../utils/validators.js";


function canRoleExecuteTransition(
    roleName: string | undefined,
    currentStatusCode: string,
    nextStatusCode: string,
) {
    if (roleName === 'admin') return true

    if (roleName === 'warehouse_operator') {
        return (
            currentStatusCode !== 'RETORNADO_CLIENTE' &&
            nextStatusCode !== 'CERRADO'
        )
    }

    if (roleName === 'client_operator') {
        return (
            currentStatusCode === 'RETORNADO_CLIENTE' &&
            nextStatusCode === 'CERRADO'
        )
    }

    return false
}
const allowedTransitions: Record<string, string[]> = {
    EN_PROCESO: ['REPROCESO', 'PREPARADO_DESPACHO'],
    REPROCESO: ['EN_PROCESO', 'PREPARADO_DESPACHO'],
    DERIVADO_EXTERNO: ['EN_TRASLADO'],
    PREPARADO_DESPACHO: ['EN_TRASLADO'],
    EN_TRASLADO: ['RETORNADO_CLIENTE'],
    RETORNADO_CLIENTE: ['CERRADO'],
}

function buildClientPrefix(clientName: string) {
    return clientName
        .split(/\s+/)
        .map((word) => word[0])
        .join("")
        .slice(0, 3)
        .toLowerCase();
}

async function generateBatchNumber(clientName: string) {
    const prefix = buildClientPrefix(clientName);

    const lastBatch = await GarmentBatch.findOne({
        where: {
            batch_number: {
                [Op.iLike]: `lote-${prefix}-%`,
            },
        },
        order: [["createdAt", "DESC"]],
    });

    let nextNumber = 1;

    if (lastBatch) {
        const parts = lastBatch.batch_number.split("-");
        const lastNumber = Number(parts[2]);

        if (!Number.isNaN(lastNumber)) {
            nextNumber = lastNumber + 1;
        }
    }

    return `lote-${prefix}-${String(nextNumber).padStart(3, "0")}`;
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
        const id = req.params.id as string;

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
            if (typeof client_id !== "string" || !client_id.trim()) {
                return res.status(400).json({
                    ok: false,
                    message: "client_id es obligatorio para administrador",
                });
            }

            finalClientId = client_id.trim();
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

        const initialStatus = await MovementStatus.findOne({
            where: {
                code: "BORRADOR_CLIENTE",
            },
        });

        if (!initialStatus) {
            return res.status(500).json({
                ok: false,
                message: "No existe estado inicial PENDIENTE_RECEPCION",
            });
        }

        const batchNumber = await generateBatchNumber(client.name);

        const batch = await GarmentBatch.create({
            client_id: finalClientId || '',
            batch_number: batchNumber,
            created_by: user.id,
            origin_location: "Cliente",
            destination_location: "Planta Central",
            current_status_id: initialStatus.id,
            received_at: null,
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
    const transaction = await sequelize.transaction()

    try {
        const id = req.params.id as string;
        const { notes } = req.body;

        const batch = await GarmentBatch.findByPk(id, {
            include: [
                {
                    model: MovementStatus,
                    as: "current_status",
                    attributes: ["id", "code", "name"],
                },
            ],
            transaction,
        });

        if (!batch) {
            await transaction.rollback()
            return res.status(404).json({
                ok: false,
                message: "Lote no encontrado",
            });
        }

        const batchJson = batch.toJSON() as any;

        if (batchJson.current_status?.code !== "PENDIENTE_RECEPCION") {
            await transaction.rollback()
            return res.status(400).json({
                ok: false,
                message: "Solo se pueden recepcionar lotes en estado Pendiente Recepción",
            });
        }

        const receivedStatus = await MovementStatus.findOne({
            where: {
                code: "RECEPCIONADO",
            },
            transaction,
        });

        if (!receivedStatus) {
            await transaction.rollback()
            return res.status(500).json({
                ok: false,
                message: "No existe estado RECEPCIONADO",
            });
        }

        await batch.update({
            current_status_id: receivedStatus.id,
            received_at: new Date(),
            notes: notes ? `${batch.notes || ""}\nRecepción: ${notes}` : batch.notes,
        }, { transaction });

        await transaction.commit()

        return res.json({
            ok: true,
            message: "Lote recepcionado correctamente",
            data: batch,
        });
    } catch (error) {
        await transaction.rollback()
        console.error(error);

        return res.status(500).json({
            ok: false,
            message: "Error recepcionando lote",
        });
    }
}

export async function evaluateOperatorBatch(req: Request, res: Response) {
    const transaction = await sequelize.transaction()

    try {
        const id = req.params.id as string;
        const { can_process, notes } = req.body;

        if (typeof can_process !== "boolean") {
            await transaction.rollback()
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
            transaction,
        });

        if (!batch) {
            await transaction.rollback()
            return res.status(404).json({
                ok: false,
                message: "Lote no encontrado",
            });
        }

        const batchJson = batch.toJSON() as any;

        if (batchJson.current_status?.code !== "RECEPCIONADO") {
            await transaction.rollback()
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
            transaction,
        });

        if (!nextStatus) {
            await transaction.rollback()
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
        }, { transaction });

        await transaction.commit()

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
    const transaction = await sequelize.transaction()

    try {
        const id = req.params.id as string
        const { next_status_code, notes, client_accepted, client_observation } = req.body

        if (!isNonEmptyString(next_status_code)) {
            await transaction.rollback()
            return res.status(400).json({
                ok: false,
                message: 'next_status_code es obligatorio',
            })
        }

        const nextStatusCode = next_status_code.trim().toUpperCase()

        const batch = await GarmentBatch.findByPk(id, {
            include: [
                {
                    model: MovementStatus,
                    as: 'current_status',
                    attributes: ['id', 'code', 'name'],
                },
            ],
            transaction,
        })

        if (!batch) {
            await transaction.rollback()
            return res.status(404).json({
                ok: false,
                message: 'Lote no encontrado',
            })
        }

        const batchJson = batch.toJSON() as any
        const currentCode = batchJson.current_status?.code

        const allowedNextStatuses = allowedTransitions[currentCode] || []

        if (!allowedNextStatuses.includes(nextStatusCode)) {
            await transaction.rollback()
            return res.status(400).json({
                ok: false,
                message: `No se permite cambiar de ${currentCode} a ${nextStatusCode}`,
            })
        }

        const roleName = req.user?.role?.name

        if (
            roleName === 'client_operator' &&
            batch.client_id !== req.user?.client_id
        ) {
            await transaction.rollback()
            return res.status(403).json({
                ok: false,
                message: 'No puedes cerrar lotes de otro cliente',
            })
        }

        if (!canRoleExecuteTransition(roleName, currentCode, nextStatusCode)) {
            await transaction.rollback()
            return res.status(403).json({
                ok: false,
                message: 'No tienes permisos para realizar esta transición',
            })
        }

        const nextStatus = await MovementStatus.findOne({
            where: {
                code: nextStatusCode,
            },
            transaction,
        })

        if (!nextStatus) {
            await transaction.rollback()
            return res.status(404).json({
                ok: false,
                message: 'Estado destino no encontrado',
            })
        }

        const clientAcceptedNote =
            typeof client_accepted === "boolean"
                ? `Conformidad cliente: ${client_accepted ? "aceptada" : "rechazada"}`
                : null
        const clientObservationNote =
            isNonEmptyString(client_observation)
                ? `Observacion cliente: ${client_observation.trim()}`
                : null

        const statusNote = `Cambio de estado: ${currentCode} → ${nextStatusCode}`

        await batch.update({
            current_status_id: nextStatus.id,
            closed_at: nextStatusCode === 'CERRADO' ? new Date() : batch.closed_at,
            notes: [batch.notes, statusNote, notes ? `Observación: ${notes}` : null]
                .concat([clientAcceptedNote, clientObservationNote])
                .filter(Boolean)
                .join('\n'),
        }, { transaction })

        await transaction.commit()

        return res.json({
            ok: true,
            message: 'Estado del lote actualizado correctamente',
            data: batch,
        })
    } catch (error) {
        await transaction.rollback()
        console.error(error)

        return res.status(500).json({
            ok: false,
            message: 'Error actualizando estado del lote',
        })
    }
}

export async function dispatchClientBatch(req: Request, res: Response) {
    const transaction = await sequelize.transaction()

    try {
        const id = req.params.id as string
        const user = req.user

        if (!user) {
            await transaction.rollback()
            return res.status(401).json({
                ok: false,
                message: "Usuario no autenticado",
            })
        }

        const batch = await GarmentBatch.findByPk(id, {
            include: [
                {
                    model: MovementStatus,
                    as: "current_status",
                    attributes: ["id", "code", "name"],
                },
            ],
            transaction,
        })

        if (!batch) {
            await transaction.rollback()
            return res.status(404).json({
                ok: false,
                message: "Lote no encontrado",
            })
        }

        const batchJson = batch.toJSON() as any

        if (
            user?.role?.name === "client_operator" &&
            batch.client_id !== user.client_id
        ) {
            await transaction.rollback()
            return res.status(403).json({
                ok: false,
                message: "No puedes despachar lotes de otro cliente",
            })
        }

        if (batchJson.current_status?.code !== "BORRADOR_CLIENTE") {
            await transaction.rollback()
            return res.status(400).json({
                ok: false,
                message: "Solo se pueden despachar lotes en borrador",
            })
        }

        const draftStatus = await MovementStatus.findOne({
            where: { code: "BORRADOR_CLIENTE" },
            transaction,
        })

        const pendingStatus = await MovementStatus.findOne({
            where: { code: "PENDIENTE_RECEPCION" },
            transaction,
        })

        if (!draftStatus || !pendingStatus) {
            await transaction.rollback()
            return res.status(500).json({
                ok: false,
                message: "No existen estados BORRADOR_CLIENTE o PENDIENTE_RECEPCION",
            })
        }

        const items = await GarmentBatchItem.findAll({
            where: { batch_id: id },
            transaction,
        })

        if (items.length === 0) {
            await transaction.rollback()
            return res.status(400).json({
                ok: false,
                message: "No se puede despachar un lote sin prendas",
            })
        }

        for (const item of items) {
            const quantity = Number(item.quantity_sent || 0)

            const originStock = await GarmentStock.findOne({
                where: {
                    client_id: batch.client_id,
                    garment_id: item.garment_id,
                    status_id: draftStatus.id,
                },
                transaction,
            })

            if (!originStock || Number(originStock.quantity) < quantity) {
                await transaction.rollback()
                return res.status(400).json({
                    ok: false,
                    message: `Stock insuficiente en borrador para la prenda ${item.garment_id}`,
                })
            }

            await originStock.update(
                {
                    quantity: Number(originStock.quantity) - quantity,
                },
                { transaction },
            )

            const [destinationStock, createdDestinationStock] =
                await GarmentStock.findOrCreate({
                    where: {
                        client_id: batch.client_id,
                        garment_id: item.garment_id,
                        status_id: pendingStatus.id,
                    },
                    defaults: {
                        client_id: batch.client_id,
                        garment_id: item.garment_id,
                        status_id: pendingStatus.id,
                        quantity,
                    },
                    transaction,
                })

            if (!createdDestinationStock) {
                await destinationStock.update(
                    {
                        quantity: Number(destinationStock.quantity || 0) + quantity,
                    },
                    { transaction },
                )
            }

            await GarmentMovement.create(
                {
                    batch_id: id,
                    garment_id: item.garment_id,
                    from_status_id: draftStatus.id,
                    to_status_id: pendingStatus.id,
                    quantity,
                    movement_type: "despacho_cliente",
                    created_by: user.id,
                    notes: "Despacho automático desde cliente a planta",
                },
                { transaction },
            )
        }

        await batch.update(
            {
                current_status_id: pendingStatus.id,
                notes: [batch.notes, "Despachado desde cliente"].filter(Boolean).join("\n"),
            },
            { transaction },
        )

        await transaction.commit()

        return res.json({
            ok: true,
            message: "Lote despachado a planta correctamente",
            data: batch,
        })
    } catch (error) {
        await transaction.rollback()
        console.error(error)

        return res.status(500).json({
            ok: false,
            message: "Error despachando lote",
        })
    }
}

export async function previewOperatorBatchNumber(req: Request, res: Response) {
    try {
        const { client_id } = req.query
        const user = req.user

        if (!user) {
            return res.status(401).json({
                ok: false,
                message: 'Usuario no autenticado',
            })
        }

        const roleName = user.role?.name

        let finalClientId: string | null = null

        if (roleName === 'client_operator') {
            finalClientId = user.client_id
        }

        if (roleName === 'admin') {
            finalClientId = typeof client_id === "string" ? client_id.trim() : null
        }

        if (!finalClientId) {
            return res.status(400).json({
                ok: false,
                message: 'client_id es obligatorio',
            })
        }

        const client = await Client.findByPk(finalClientId)

        if (!client) {
            return res.status(404).json({
                ok: false,
                message: 'Cliente no encontrado',
            })
        }

        const batchNumber = await generateBatchNumber(client.name)

        return res.json({
            ok: true,
            data: {
                batch_number: batchNumber,
                origin_location: 'Cliente',
                destination_location: 'Planta',
            },
        })
    } catch (error) {
        console.error(error)

        return res.status(500).json({
            ok: false,
            message: 'Error generando número de lote',
        })
    }
}

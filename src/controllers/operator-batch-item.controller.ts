import type { Request, Response } from "express";
import {
    Garment,
    GarmentBatch,
    GarmentBatchItem,
    GarmentProcess,
    GarmentType,
    MovementStatus,
} from "../models/index.js";

function isClientOperator(req: Request) {
    return req.user?.role?.name === "client_operator";
}

function isAdmin(req: Request) {
    return req.user?.role?.name === "admin";
}

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
                {
                    model: GarmentProcess,
                    as: "process",
                    attributes: ["id", "name", "code", "percentage"],
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

async function assertBatchEditableByClient(batchId: string, req: Request) {
    const batch = await GarmentBatch.findByPk(batchId, {
        include: [
            {
                model: MovementStatus,
                as: "current_status",
                attributes: ["id", "code", "name"],
            },
        ],
    });

    if (!batch) {
        return {
            ok: false,
            status: 404,
            message: "Lote no encontrado",
            batch: null,
        };
    }

    const batchJson = batch.toJSON() as any;

    if (isClientOperator(req) && batch.client_id !== req.user?.client_id) {
        return {
            ok: false,
            status: 403,
            message: "No puedes modificar lotes de otro cliente",
            batch: null,
        };
    }

    if (batchJson.current_status?.code !== "PENDIENTE_RECEPCION") {
        return {
            ok: false,
            status: 400,
            message: "Solo se pueden modificar prendas de lotes pendientes de recepción",
            batch: null,
        };
    }

    return {
        ok: true,
        status: 200,
        message: "",
        batch,
    };
}

export async function addBatchItem(req: Request, res: Response) {
    try {
        const { batchId } = req.params;

        const {
            garment_id,
            quantity_sent,
            garment_process_id,
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

        /* const batch = await GarmentBatch.findByPk(batchId); */

        const validation = await assertBatchEditableByClient(batchId, req);

        if (!validation.ok) {
            return res.status(validation.status).json({
                ok: false,
                message: validation.message,
            });
        }

        const batch = validation.batch!;

        if (isClientOperator(req) && batch.client_id !== req.user?.client_id) {
            return res.status(403).json({
                ok: false,
                message: "No puedes modificar lotes de otro cliente",
            });
        }

        const garment = await Garment.findByPk(garment_id);

        if (!garment) {
            return res.status(404).json({
                ok: false,
                message: "Prenda no encontrada",
            });
        }

        /*  if (garment.client_id !== batch.client_id) {
             return res.status(400).json({
                 ok: false,
                 message: "La prenda no pertenece al cliente del lote",
             });
         } */

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

        let process = null;

        if (garment_process_id) {
            process = await GarmentProcess.findByPk(garment_process_id);

            if (!process) {
                return res.status(404).json({
                    ok: false,
                    message: "Proceso no encontrado",
                });
            }
        }

        const unitValue = Number(garment.value || 0);
        const processPercentage = Number(process?.percentage || 0);

        let calculatedUnitValue = unitValue + (unitValue * processPercentage) / 100;

        if (process?.code === "REPROCESO") {
            calculatedUnitValue = 0;
        }

        const calculatedTotal =
            calculatedUnitValue * Number(quantity_received || quantity_sent);

        const item = await GarmentBatchItem.create({
            batch_id: batchId,
            garment_id,
            garment_process_id: garment_process_id || null,
            quantity_sent,
            quantity_received: quantity_received || 0,
            quantity_processed: 0,
            quantity_reprocessed: 0,
            quantity_returned: 0,
            unit_value: unitValue,
            process_percentage: processPercentage,
            calculated_unit_value: calculatedUnitValue,
            calculated_total: calculatedTotal,
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
            garment_process_id,
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

        const garment = await Garment.findByPk(item.garment_id);

        if (!garment) {
            return res.status(404).json({
                ok: false,
                message: "Prenda no encontrada",
            });
        }

        let process = null;

        if (garment_process_id) {
            process = await GarmentProcess.findByPk(garment_process_id);

            if (!process) {
                return res.status(404).json({
                    ok: false,
                    message: "Proceso no encontrado",
                });
            }
        }

        /* const batch = await GarmentBatch.findByPk(batchId); */

        const validation = await assertBatchEditableByClient(batchId, req);

        if (!validation.ok) {
            return res.status(validation.status).json({
                ok: false,
                message: validation.message,
            });
        }

        const batch = validation.batch!;

        if (!batch) {
            return res.status(404).json({
                ok: false,
                message: "Lote no encontrado",
            });
        }

        if (isClientOperator(req) && batch.client_id !== req.user?.client_id) {
            return res.status(403).json({
                ok: false,
                message: "No puedes modificar lotes de otro cliente",
            });
        }

        const finalQuantityReceived =
            typeof quantity_received === "number"
                ? quantity_received
                : item.quantity_received;

        const finalQuantitySent =
            typeof quantity_sent === "number"
                ? quantity_sent
                : item.quantity_sent;

        const quantityForCalculation = finalQuantityReceived || finalQuantitySent;

        const unitValue = Number(garment.value || 0);
        const processPercentage = Number(process?.percentage || item.process_percentage || 0);
        const calculatedUnitValue = unitValue + (unitValue * processPercentage) / 100;
        const calculatedTotal = calculatedUnitValue * quantityForCalculation;

        await item.update({
            garment_process_id:
                garment_process_id !== undefined
                    ? garment_process_id || null
                    : item.garment_process_id,
            unit_value: unitValue,
            process_percentage: processPercentage,
            calculated_unit_value: calculatedUnitValue,
            calculated_total: calculatedTotal,
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

        /* const batch = await GarmentBatch.findByPk(batchId); */

        const validation = await assertBatchEditableByClient(batchId, req);

        if (!validation.ok) {
            return res.status(validation.status).json({
                ok: false,
                message: validation.message,
            });
        }

        const batch = validation.batch!;

        if (!batch) {
            return res.status(404).json({
                ok: false,
                message: "Lote no encontrado",
            });
        }

        if (isClientOperator(req) && batch.client_id !== req.user?.client_id) {
            return res.status(403).json({
                ok: false,
                message: "No puedes modificar lotes de otro cliente",
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
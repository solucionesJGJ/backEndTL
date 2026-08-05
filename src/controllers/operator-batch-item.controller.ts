import type { Request, Response } from "express";
import {
    Garment,
    GarmentBatch,
    GarmentBatchItem,
    GarmentMovement,
    GarmentProcess,
    GarmentStock,
    GarmentType,
    MovementStatus,
    sequelize,
} from "../models/index.js";
import {
    isNonEmptyString,
    isOptionalNonNegativeInteger,
    isPositiveInteger,
} from "../utils/validators.js";

function isClientOperator(req: Request) {
    return req.user?.role?.name === "client_operator";
}

function calculateBatchItemValues(
    garmentValue: unknown,
    process: GarmentProcess | null,
    quantitySent: number,
    quantityReceived: number,
) {
    const unitValue = Number(garmentValue || 0);
    const processPercentage = Number(process?.percentage || 0);

    let calculatedUnitValue = unitValue + (unitValue * processPercentage) / 100;

    if (process?.code === "REPROCESO") {
        calculatedUnitValue = 0;
    }

    const quantityForCalculation = quantityReceived || quantitySent;

    return {
        unitValue,
        processPercentage,
        calculatedUnitValue,
        calculatedTotal: calculatedUnitValue * quantityForCalculation,
    };
}

export async function getBatchItems(req: Request, res: Response) {
    try {
        const batchId = req.params.batchId as string;

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

async function assertBatchEditableByClient(batchId: string, req: Request, transaction?: any) {
    const batch = await GarmentBatch.findByPk(batchId, {
        transaction,
        ...(transaction
            ? {
                lock: transaction.LOCK.UPDATE,
            }
            : {}),
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

    const currentStatus = await MovementStatus.findByPk(
        batchJson.current_status_id,
        {
            transaction,
            attributes: ['id', 'code', 'name'],
        },
    )

    if (!currentStatus) {
        return {
            ok: false as const,
            status: 500,
            message: 'El lote no tiene un estado válido asociado',
        }
    }

    if (currentStatus.code !== 'BORRADOR_CLIENTE') {
        return {
            ok: false as const,
            status: 400,
            message: 'El lote ya no puede ser modificado',
        }
    }

    if (
        isClientOperator(req) &&
        batch.client_id !== req.user?.client_id
    ) {
        return {
            ok: false as const,
            status: 403,
            message: 'No puedes modificar lotes de otro cliente',
        }
    }


    return {
        ok: true,
        status: 200,
        message: "",
        batch,
    };
}

export async function addBatchItem(req: Request, res: Response) {
    const transaction = await sequelize.transaction();

    try {
        const batchId = req.params.batchId as string;

        if (!req.user) {
            await transaction.rollback();
            return res.status(401).json({
                ok: false,
                message: "Usuario no autenticado",
            });
        }

        const {
            garment_id,
            quantity_sent,
            garment_process_id,
            quantity_received,
            notes,
        } = req.body;

        if (!isNonEmptyString(garment_id)) {
            await transaction.rollback();
            return res.status(400).json({
                ok: false,
                message: "garment_id es obligatorio",
            });
        }

        if (!isPositiveInteger(quantity_sent)) {
            await transaction.rollback();
            return res.status(400).json({
                ok: false,
                message: "quantity_sent debe ser un entero mayor a 0",
            });
        }

        if (!isOptionalNonNegativeInteger(quantity_received)) {
            await transaction.rollback();
            return res.status(400).json({
                ok: false,
                message: "quantity_received debe ser un entero mayor o igual a 0",
            });
        }

        if (isClientOperator(req) && Number(quantity_received || 0) > 0) {
            await transaction.rollback();
            return res.status(400).json({
                ok: false,
                message: "El cliente no puede informar quantity_received al crear items",
            });
        }

        const validation = await assertBatchEditableByClient(batchId, req, transaction);

        if (!validation.ok) {
            await transaction.rollback();
            return res.status(validation.status).json({
                ok: false,
                message: validation.message,
            });
        }

        const batch = validation.batch!;

        if (isClientOperator(req) && batch.client_id !== req.user?.client_id) {
            await transaction.rollback();
            return res.status(403).json({
                ok: false,
                message: "No puedes modificar lotes de otro cliente",
            });
        }

        const garment = await Garment.findByPk(garment_id, { transaction });

        if (!garment) {
            await transaction.rollback();
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
            transaction,
            lock: transaction.LOCK.UPDATE,
        });

        if (existingItem) {
            await transaction.rollback();
            return res.status(409).json({
                ok: false,
                message: "La prenda ya existe en este lote",
            });
        }

        let process = null;

        if (garment_process_id !== undefined && garment_process_id !== null && garment_process_id !== "" && !isNonEmptyString(garment_process_id)) {
            await transaction.rollback();
            return res.status(400).json({
                ok: false,
                message: "garment_process_id debe ser un identificador valido",
            });
        }

        if (isNonEmptyString(garment_process_id)) {
            process = await GarmentProcess.findByPk(garment_process_id, { transaction });

            if (!process) {
                await transaction.rollback();
                return res.status(404).json({
                    ok: false,
                    message: "Proceso no encontrado",
                });
            }
        }

        const initialStockStatus = await MovementStatus.findOne({
            where: {
                code: "BORRADOR_CLIENTE",
            },
            transaction,
        });

        if (!initialStockStatus) {
            await transaction.rollback();
            return res.status(500).json({
                ok: false,
                message: "No existe estado BORRADOR_CLIENTE para stock inicial",
            });
        }

        const finalQuantitySent = Number(quantity_sent);
        const finalQuantityReceived = isClientOperator(req) ? 0 : Number(quantity_received || 0);
        const {
            unitValue,
            processPercentage,
            calculatedUnitValue,
            calculatedTotal,
        } = calculateBatchItemValues(
            garment.value,
            process,
            finalQuantitySent,
            finalQuantityReceived,
        );

        const item = await GarmentBatchItem.create({
            batch_id: batchId,
            garment_id,
            garment_process_id: isNonEmptyString(garment_process_id) ? garment_process_id : null,
            quantity_sent: finalQuantitySent,
            quantity_received: finalQuantityReceived,
            quantity_processed: 0,
            quantity_reprocessed: 0,
            quantity_returned: 0,
            unit_value: unitValue,
            process_percentage: processPercentage,
            calculated_unit_value: calculatedUnitValue,
            calculated_total: calculatedTotal,
            notes: notes || null,
        }, {
            transaction,
        });

        const [stock, createdStock] = await GarmentStock.findOrCreate({
            where: {
                client_id: batch.client_id,
                garment_id,
                status_id: initialStockStatus.id,
            },
            defaults: {
                client_id: batch.client_id,
                garment_id,
                status_id: initialStockStatus.id,
                quantity: finalQuantitySent,
            },
            transaction,
            lock: transaction.LOCK.UPDATE,
        });

        if (!createdStock) {
            await stock.update({
                quantity: Number(stock.quantity || 0) + finalQuantitySent,
            }, {
                transaction,
            });
        }

        await GarmentMovement.create({
            batch_id: batchId,
            garment_id,
            from_status_id: null,
            to_status_id: initialStockStatus.id,
            quantity: finalQuantitySent,
            movement_type: "alta_borrador_cliente",
            created_by: req.user.id,
            notes: "Alta automatica de prenda en borrador cliente",
        }, {
            transaction,
        });

        await transaction.commit();

        return res.status(201).json({
            ok: true,
            message: "Prenda agregada al lote correctamente",
            data: item,
        });
    } catch (error) {
        await transaction.rollback();
        console.error(error);

        return res.status(500).json({
            ok: false,
            message: "Error agregando prenda al lote",
        });
    }
}

export async function updateBatchItem(req: Request, res: Response) {
    const transaction = await sequelize.transaction();

    try {
        const batchId = req.params.batchId as string;
        const itemId = req.params.itemId as string;

        if (!req.user) {
            await transaction.rollback();
            return res.status(401).json({
                ok: false,
                message: "Usuario no autenticado",
            });
        }

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
            transaction,
            lock: transaction.LOCK.UPDATE,
        });

        if (!item) {
            await transaction.rollback();
            return res.status(404).json({
                ok: false,
                message: "Prenda del lote no encontrada",
            });
        }

        const quantityValidations = [
            { value: quantity_sent, name: "quantity_sent" },
            { value: quantity_received, name: "quantity_received" },
            { value: quantity_processed, name: "quantity_processed" },
            { value: quantity_reprocessed, name: "quantity_reprocessed" },
            { value: quantity_returned, name: "quantity_returned" },
        ];

        for (const quantityValidation of quantityValidations) {
            if (!isOptionalNonNegativeInteger(quantityValidation.value)) {
                await transaction.rollback();
                return res.status(400).json({
                    ok: false,
                    message: `${quantityValidation.name} debe ser un entero mayor o igual a 0`,
                });
            }
        }

        const garment = await Garment.findByPk(item.garment_id, { transaction });

        if (!garment) {
            await transaction.rollback();
            return res.status(404).json({
                ok: false,
                message: "Prenda no encontrada",
            });
        }

        let process = null;

        if (garment_process_id !== undefined && garment_process_id !== null && garment_process_id !== "" && !isNonEmptyString(garment_process_id)) {
            await transaction.rollback();
            return res.status(400).json({
                ok: false,
                message: "garment_process_id debe ser un identificador valido",
            });
        }

        if (isNonEmptyString(garment_process_id)) {
            process = await GarmentProcess.findByPk(garment_process_id, { transaction });

            if (!process) {
                await transaction.rollback();
                return res.status(404).json({
                    ok: false,
                    message: "Proceso no encontrado",
                });
            }
        }

        const validation = await assertBatchEditableByClient(batchId, req, transaction);

        if (!validation.ok) {
            await transaction.rollback();
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
            await transaction.rollback();
            return res.status(403).json({
                ok: false,
                message: "No puedes modificar lotes de otro cliente",
            });
        }

        const draftStatus = await MovementStatus.findOne({
            where: { code: "BORRADOR_CLIENTE" },
            transaction,
        });

        if (!draftStatus) {
            await transaction.rollback();
            return res.status(500).json({
                ok: false,
                message: "No existe estado BORRADOR_CLIENTE para ajustar stock",
            });
        }

        const finalQuantityReceived =
            quantity_received !== undefined && quantity_received !== null && quantity_received !== ""
                ? Number(quantity_received)
                : item.quantity_received;

        const finalQuantitySent =
            quantity_sent !== undefined && quantity_sent !== null && quantity_sent !== ""
                ? Number(quantity_sent)
                : item.quantity_sent;

        const oldQuantitySent = Number(item.quantity_sent || 0);
        const newQuantitySent = Number(finalQuantitySent || 0);
        const delta = newQuantitySent - oldQuantitySent;

        let finalProcess = process;

        if (garment_process_id === undefined && item.garment_process_id) {
            finalProcess = await GarmentProcess.findByPk(item.garment_process_id, { transaction });
        }

        const {
            unitValue,
            processPercentage,
            calculatedUnitValue,
            calculatedTotal,
        } = calculateBatchItemValues(
            garment.value,
            finalProcess,
            Number(finalQuantitySent || 0),
            Number(finalQuantityReceived || 0),
        );

        await item.update({
            garment_process_id:
                garment_process_id !== undefined
                    ? isNonEmptyString(garment_process_id) ? garment_process_id : null
                    : item.garment_process_id,
            unit_value: unitValue,
            process_percentage: processPercentage,
            calculated_unit_value: calculatedUnitValue,
            calculated_total: calculatedTotal,
            quantity_sent:
                quantity_sent !== undefined && quantity_sent !== null && quantity_sent !== ""
                    ? Number(quantity_sent)
                    : item.quantity_sent,
            quantity_received:
                quantity_received !== undefined && quantity_received !== null && quantity_received !== ""
                    ? Number(quantity_received)
                    : item.quantity_received,
            quantity_processed:
                quantity_processed !== undefined && quantity_processed !== null && quantity_processed !== ""
                    ? Number(quantity_processed)
                    : item.quantity_processed,
            quantity_reprocessed:
                quantity_reprocessed !== undefined && quantity_reprocessed !== null && quantity_reprocessed !== ""
                    ? Number(quantity_reprocessed)
                    : item.quantity_reprocessed,
            quantity_returned:
                quantity_returned !== undefined && quantity_returned !== null && quantity_returned !== ""
                    ? Number(quantity_returned)
                    : item.quantity_returned,
            notes: notes ?? item.notes,
        }, {
            transaction,
        });

        if (delta !== 0) {
            const stock = await GarmentStock.findOne({
                where: {
                    client_id: batch.client_id,
                    garment_id: item.garment_id,
                    status_id: draftStatus.id,
                },
                transaction,
                lock: transaction.LOCK.UPDATE,
            });

            if (!stock) {
                await transaction.rollback();
                return res.status(400).json({
                    ok: false,
                    message: "No existe stock BORRADOR_CLIENTE para ajustar el item",
                });
            }

            if (delta < 0 && Number(stock.quantity || 0) < Math.abs(delta)) {
                await transaction.rollback();
                return res.status(400).json({
                    ok: false,
                    message: "Stock insuficiente en borrador para disminuir la cantidad",
                });
            }

            await stock.update({
                quantity: Number(stock.quantity || 0) + delta,
            }, {
                transaction,
            });

            await GarmentMovement.create({
                batch_id: batchId,
                garment_id: item.garment_id,
                from_status_id: delta < 0 ? draftStatus.id : null,
                to_status_id: delta > 0 ? draftStatus.id : null,
                quantity: Math.abs(delta),
                movement_type: delta > 0
                    ? "ajuste_alta_borrador_cliente"
                    : "ajuste_baja_borrador_cliente",
                created_by: req.user.id,
                notes: delta > 0
                    ? "Ajuste de aumento de prenda en borrador cliente"
                    : "Ajuste de disminucion de prenda en borrador cliente",
            }, {
                transaction,
            });
        }

        await transaction.commit();

        return res.json({
            ok: true,
            message: "Prenda del lote actualizada correctamente",
            data: item,
        });
    } catch (error) {
        await transaction.rollback();
        console.error(error);

        return res.status(500).json({
            ok: false,
            message: "Error actualizando prenda del lote",
        });
    }
}

export async function removeBatchItem(req: Request, res: Response) {
    const transaction = await sequelize.transaction();

    try {
        const batchId = req.params.batchId as string;
        const itemId = req.params.itemId as string;

        if (!req.user) {
            await transaction.rollback();
            return res.status(401).json({
                ok: false,
                message: "Usuario no autenticado",
            });
        }

        const item = await GarmentBatchItem.findOne({
            where: {
                id: itemId,
                batch_id: batchId,
            },
            transaction,
            lock: transaction.LOCK.UPDATE,
        });

        if (!item) {
            await transaction.rollback();
            return res.status(404).json({
                ok: false,
                message: "Prenda del lote no encontrada",
            });
        }

        const validation = await assertBatchEditableByClient(batchId, req, transaction);

        if (!validation.ok) {
            await transaction.rollback();
            return res.status(validation.status).json({
                ok: false,
                message: validation.message,
            });
        }

        const batch = validation.batch!;

        if (!batch) {
            await transaction.rollback();
            return res.status(404).json({
                ok: false,
                message: "Lote no encontrado",
            });
        }

        if (isClientOperator(req) && batch.client_id !== req.user?.client_id) {
            await transaction.rollback();
            return res.status(403).json({
                ok: false,
                message: "No puedes modificar lotes de otro cliente",
            });
        }

        const draftStatus = await MovementStatus.findOne({
            where: { code: "BORRADOR_CLIENTE" },
            transaction,
        });

        if (!draftStatus) {
            await transaction.rollback();
            return res.status(500).json({
                ok: false,
                message: "No existe estado BORRADOR_CLIENTE para anular item",
            });
        }

        const quantity = Number(item.quantity_sent || 0);

        const stock = await GarmentStock.findOne({
            where: {
                client_id: batch.client_id,
                garment_id: item.garment_id,
                status_id: draftStatus.id,
            },
            transaction,
            lock: transaction.LOCK.UPDATE,
        });

        if (!stock || Number(stock.quantity || 0) < quantity) {
            await transaction.rollback();
            return res.status(400).json({
                ok: false,
                message: "Stock insuficiente en borrador para eliminar el item",
            });
        }

        await stock.update({
            quantity: Number(stock.quantity || 0) - quantity,
        }, {
            transaction,
        });

        await GarmentMovement.create({
            batch_id: batchId,
            garment_id: item.garment_id,
            from_status_id: draftStatus.id,
            to_status_id: null,
            quantity,
            movement_type: "anulacion_item_borrador_cliente",
            created_by: req.user.id,
            notes: "Anulacion de prenda en borrador cliente",
        }, {
            transaction,
        });

        await item.destroy({ transaction });

        await transaction.commit();

        return res.json({
            ok: true,
            message: "Prenda eliminada del lote correctamente",
        });
    } catch (error) {
        await transaction.rollback();
        console.error(error);

        return res.status(500).json({
            ok: false,
            message: "Error eliminando prenda del lote",
        });
    }
}

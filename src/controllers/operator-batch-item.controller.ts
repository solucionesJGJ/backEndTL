import type { Request, Response } from "express";

import {
    Client,
    Garment,
    GarmentBatch,
    GarmentBatchItem,
    GarmentMovement,
    GarmentStock,
    MovementStatus,
    sequelize,
} from "../models/index.js";

import {
    isNonEmptyString,
    isOptionalNonNegativeInteger,
    isPositiveInteger,
} from "../utils/validators.js";


/**
 * Determina si el usuario autenticado es operador cliente.
 */
function isClientOperator(req: Request) {
    return req.user?.role?.name === "client_operator";
}


/**
 * Calcula los valores comerciales iniciales del item.
 *
 * IMPORTANTE:
 * El precio recibido aquí se congela en unit_value.
 *
 * Una vez creado el item, futuras modificaciones de precio
 * en Garment.value NO deben modificar este valor.
 */
function calculateBatchItemValues(
    garmentValue: unknown,
    quantitySent: number,
) {
    const unitValue = Number(garmentValue || 0);

    return {
        unitValue,
        calculatedTotal: unitValue * quantitySent,
    };
}


/**
 * GET /batches/:batchId/items
 *
 * Obtiene las prendas pertenecientes a un lote.
 */
export async function getBatchItems(
    req: Request,
    res: Response,
) {
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
                            model: Client,
                            as: "client",
                            attributes: [
                                "id",
                                "name",
                                "code_prefix",
                            ],
                        },
                    ],
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


/**
 * Verifica que un lote pueda ser modificado.
 *
 * Reglas:
 * - El lote debe existir.
 * - Debe encontrarse en BORRADOR_CLIENTE.
 * - Si el usuario es client_operator, solamente puede
 *   modificar lotes de su propio cliente.
 */
async function assertBatchEditableByClient(
    batchId: string,
    req: Request,
    transaction?: any,
) {
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
            attributes: [
                "id",
                "code",
                "name",
            ],
        },
    );

    if (!currentStatus) {
        return {
            ok: false as const,
            status: 500,
            message:
                "El lote no tiene un estado válido asociado",
            batch: null,
        };
    }

    if (currentStatus.code !== "BORRADOR_CLIENTE") {
        return {
            ok: false as const,
            status: 400,
            message:
                "El lote ya no puede ser modificado",
            batch: null,
        };
    }

    if (
        isClientOperator(req) &&
        batch.client_id !== req.user?.client_id
    ) {
        return {
            ok: false as const,
            status: 403,
            message:
                "No puedes modificar lotes de otro cliente",
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


/**
 * POST /batches/:batchId/items
 *
 * Agrega una prenda al lote.
 *
 * El precio actual de Garment.value se copia a
 * GarmentBatchItem.unit_value.
 *
 * Ese precio queda congelado para conservar
 * trazabilidad histórica.
 */
export async function addBatchItem(
    req: Request,
    res: Response,
) {
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
            quantity_received,
            notes,
        } = req.body;


        /**
         * Validar garment_id
         */
        if (!isNonEmptyString(garment_id)) {
            await transaction.rollback();

            return res.status(400).json({
                ok: false,
                message: "garment_id es obligatorio",
            });
        }


        /**
         * Validar cantidad enviada
         */
        if (!isPositiveInteger(quantity_sent)) {
            await transaction.rollback();

            return res.status(400).json({
                ok: false,
                message:
                    "quantity_sent debe ser un entero mayor a 0",
            });
        }


        /**
         * Validar cantidad recibida
         */
        if (
            !isOptionalNonNegativeInteger(
                quantity_received,
            )
        ) {
            await transaction.rollback();

            return res.status(400).json({
                ok: false,
                message:
                    "quantity_received debe ser un entero mayor o igual a 0",
            });
        }


        /**
         * El cliente no puede declarar cantidad recibida.
         * Eso corresponde a la operación de planta.
         */
        if (
            isClientOperator(req) &&
            Number(quantity_received || 0) > 0
        ) {
            await transaction.rollback();

            return res.status(400).json({
                ok: false,
                message:
                    "El cliente no puede informar quantity_received al crear items",
            });
        }


        /**
         * Validar que el lote sea editable.
         */
        const validation =
            await assertBatchEditableByClient(
                batchId,
                req,
                transaction,
            );

        if (!validation.ok) {
            await transaction.rollback();

            return res
                .status(validation.status)
                .json({
                    ok: false,
                    message: validation.message,
                });
        }

        const batch = validation.batch!;


        /**
         * Seguridad adicional para operador cliente.
         */
        if (
            isClientOperator(req) &&
            batch.client_id !== req.user?.client_id
        ) {
            await transaction.rollback();

            return res.status(403).json({
                ok: false,
                message:
                    "No puedes modificar lotes de otro cliente",
            });
        }


        /**
         * Buscar la prenda.
         */
        const garment = await Garment.findByPk(
            garment_id,
            {
                transaction,
            },
        );

        if (!garment) {
            await transaction.rollback();

            return res.status(404).json({
                ok: false,
                message: "Prenda no encontrada",
            });
        }


        /**
         * NUEVA REGLA:
         *
         * La prenda debe pertenecer directamente
         * al mismo cliente del lote.
         */
        if (garment.client_id !== batch.client_id) {
            await transaction.rollback();

            return res.status(400).json({
                ok: false,
                message:
                    "La prenda no pertenece al cliente del lote",
            });
        }


        /**
         * Evitar prendas duplicadas dentro del lote.
         */
        const existingItem =
            await GarmentBatchItem.findOne({
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
                message:
                    "La prenda ya existe en este lote",
            });
        }


        /**
         * Estado inicial del stock.
         */
        const initialStockStatus =
            await MovementStatus.findOne({
                where: {
                    code: "BORRADOR_CLIENTE",
                },

                transaction,
            });

        if (!initialStockStatus) {
            await transaction.rollback();

            return res.status(500).json({
                ok: false,
                message:
                    "No existe estado BORRADOR_CLIENTE para stock inicial",
            });
        }


        const finalQuantitySent =
            Number(quantity_sent);

        const finalQuantityReceived =
            isClientOperator(req)
                ? 0
                : Number(quantity_received || 0);


        /**
         * CONGELAR PRECIO
         *
         * garment.value representa el precio actual.
         *
         * Lo copiamos a unit_value del item y desde
         * este momento el lote deja de depender del
         * precio actual de la prenda.
         */
        const {
            unitValue,
            calculatedTotal,
        } = calculateBatchItemValues(
            garment.value,
            finalQuantitySent,
        );


        /**
         * Crear item del lote.
         */
        const item =
            await GarmentBatchItem.create(
                {
                    batch_id: batchId,
                    garment_id,

                    quantity_sent:
                        finalQuantitySent,

                    quantity_received:
                        finalQuantityReceived,

                    quantity_processed: 0,
                    quantity_reprocessed: 0,
                    quantity_returned: 0,

                    unit_value:
                        unitValue,

                    calculated_total:
                        calculatedTotal,

                    notes:
                        notes || null,
                },
                {
                    transaction,
                },
            );


        /**
         * Crear o actualizar stock del cliente.
         */
        const [
            stock,
            createdStock,
        ] = await GarmentStock.findOrCreate({
            where: {
                client_id:
                    batch.client_id,

                garment_id,

                status_id:
                    initialStockStatus.id,
            },

            defaults: {
                client_id:
                    batch.client_id,

                garment_id,

                status_id:
                    initialStockStatus.id,

                quantity:
                    finalQuantitySent,
            },

            transaction,

            lock:
                transaction.LOCK.UPDATE,
        });


        /**
         * Si el stock ya existía,
         * aumentar cantidad.
         */
        if (!createdStock) {
            await stock.update(
                {
                    quantity:
                        Number(
                            stock.quantity || 0,
                        ) +
                        finalQuantitySent,
                },
                {
                    transaction,
                },
            );
        }


        /**
         * Registrar movimiento.
         */
        await GarmentMovement.create(
            {
                batch_id: batchId,

                garment_id,

                from_status_id: null,

                to_status_id:
                    initialStockStatus.id,

                quantity:
                    finalQuantitySent,

                movement_type:
                    "alta_borrador_cliente",

                created_by:
                    req.user.id,

                notes:
                    "Alta automatica de prenda en borrador cliente",
            },
            {
                transaction,
            },
        );


        await transaction.commit();


        return res.status(201).json({
            ok: true,
            message:
                "Prenda agregada al lote correctamente",
            data: item,
        });

    } catch (error) {
        await transaction.rollback();

        console.error(error);

        return res.status(500).json({
            ok: false,
            message:
                "Error agregando prenda al lote",
        });
    }
}


/**
 * PUT /batches/:batchId/items/:itemId
 *
 * Modifica cantidades del item.
 *
 * IMPORTANTE:
 * unit_value NO se obtiene nuevamente desde Garment.
 * Se conserva el precio histórico almacenado
 * cuando la prenda fue agregada al lote.
 */
export async function updateBatchItem(
    req: Request,
    res: Response,
) {
    const transaction =
        await sequelize.transaction();

    try {
        const batchId =
            req.params.batchId as string;

        const itemId =
            req.params.itemId as string;


        if (!req.user) {
            await transaction.rollback();

            return res.status(401).json({
                ok: false,
                message:
                    "Usuario no autenticado",
            });
        }


        const {
            quantity_sent,
            quantity_received,
            quantity_processed,
            quantity_reprocessed,
            quantity_returned,
            notes,
        } = req.body;


        /**
         * Buscar item y bloquearlo durante
         * la transacción.
         */
        const item =
            await GarmentBatchItem.findOne({
                where: {
                    id: itemId,
                    batch_id: batchId,
                },

                transaction,

                lock:
                    transaction.LOCK.UPDATE,
            });


        if (!item) {
            await transaction.rollback();

            return res.status(404).json({
                ok: false,
                message:
                    "Prenda del lote no encontrada",
            });
        }


        /**
         * Validar cantidades recibidas.
         */
        const quantityValidations = [
            {
                value: quantity_sent,
                name: "quantity_sent",
            },
            {
                value: quantity_received,
                name: "quantity_received",
            },
            {
                value: quantity_processed,
                name: "quantity_processed",
            },
            {
                value: quantity_reprocessed,
                name: "quantity_reprocessed",
            },
            {
                value: quantity_returned,
                name: "quantity_returned",
            },
        ];


        for (
            const quantityValidation
            of quantityValidations
        ) {
            if (
                !isOptionalNonNegativeInteger(
                    quantityValidation.value,
                )
            ) {
                await transaction.rollback();

                return res.status(400).json({
                    ok: false,

                    message:
                        `${quantityValidation.name} debe ser un entero mayor o igual a 0`,
                });
            }
        }


        /**
         * Validar lote.
         */
        const validation =
            await assertBatchEditableByClient(
                batchId,
                req,
                transaction,
            );


        if (!validation.ok) {
            await transaction.rollback();

            return res
                .status(validation.status)
                .json({
                    ok: false,
                    message:
                        validation.message,
                });
        }


        const batch =
            validation.batch!;


        if (!batch) {
            await transaction.rollback();

            return res.status(404).json({
                ok: false,
                message:
                    "Lote no encontrado",
            });
        }


        if (
            isClientOperator(req) &&
            batch.client_id !==
            req.user?.client_id
        ) {
            await transaction.rollback();

            return res.status(403).json({
                ok: false,
                message:
                    "No puedes modificar lotes de otro cliente",
            });
        }


        /**
         * Estado de stock que debemos ajustar.
         */
        const draftStatus =
            await MovementStatus.findOne({
                where: {
                    code:
                        "BORRADOR_CLIENTE",
                },

                transaction,
            });


        if (!draftStatus) {
            await transaction.rollback();

            return res.status(500).json({
                ok: false,
                message:
                    "No existe estado BORRADOR_CLIENTE para ajustar stock",
            });
        }


        /**
         * Determinar nuevas cantidades.
         */
        const finalQuantityReceived =
            quantity_received !== undefined &&
                quantity_received !== null &&
                quantity_received !== ""
                ? Number(quantity_received)
                : Number(
                    item.quantity_received || 0,
                );


        const finalQuantitySent =
            quantity_sent !== undefined &&
                quantity_sent !== null &&
                quantity_sent !== ""
                ? Number(quantity_sent)
                : Number(
                    item.quantity_sent || 0,
                );


        const oldQuantitySent =
            Number(
                item.quantity_sent || 0,
            );

        const newQuantitySent =
            Number(
                finalQuantitySent || 0,
            );

        const delta =
            newQuantitySent -
            oldQuantitySent;


        /**
         * PRECIO HISTÓRICO
         *
         * No utilizamos Garment.value.
         *
         * El precio original del lote se encuentra
         * en item.unit_value.
         */
        const frozenUnitValue =
            Number(
                item.unit_value || 0,
            );


        /**
         * Recalcular total únicamente si cambia
         * la cantidad.
         *
         * El precio permanece congelado.
         */
        const calculatedTotal =
            frozenUnitValue *
            newQuantitySent;


        /**
         * Actualizar item.
         */
        await item.update(
            {
                unit_value:
                    frozenUnitValue,

                calculated_total:
                    calculatedTotal,

                quantity_sent:
                    finalQuantitySent,

                quantity_received:
                    finalQuantityReceived,

                quantity_processed:
                    quantity_processed !== undefined &&
                        quantity_processed !== null &&
                        quantity_processed !== ""
                        ? Number(
                            quantity_processed,
                        )
                        : item.quantity_processed,

                quantity_reprocessed:
                    quantity_reprocessed !== undefined &&
                        quantity_reprocessed !== null &&
                        quantity_reprocessed !== ""
                        ? Number(
                            quantity_reprocessed,
                        )
                        : item.quantity_reprocessed,

                quantity_returned:
                    quantity_returned !== undefined &&
                        quantity_returned !== null &&
                        quantity_returned !== ""
                        ? Number(
                            quantity_returned,
                        )
                        : item.quantity_returned,

                notes:
                    notes ?? item.notes,
            },
            {
                transaction,
            },
        );


        /**
         * Si cambió quantity_sent,
         * ajustar stock.
         */
        if (delta !== 0) {
            const stock =
                await GarmentStock.findOne({
                    where: {
                        client_id:
                            batch.client_id,

                        garment_id:
                            item.garment_id,

                        status_id:
                            draftStatus.id,
                    },

                    transaction,

                    lock:
                        transaction.LOCK.UPDATE,
                });


            if (!stock) {
                await transaction.rollback();

                return res.status(400).json({
                    ok: false,
                    message:
                        "No existe stock BORRADOR_CLIENTE para ajustar el item",
                });
            }


            /**
             * Si disminuimos cantidad,
             * verificar que exista stock suficiente.
             */
            if (
                delta < 0 &&
                Number(
                    stock.quantity || 0,
                ) < Math.abs(delta)
            ) {
                await transaction.rollback();

                return res.status(400).json({
                    ok: false,
                    message:
                        "Stock insuficiente en borrador para disminuir la cantidad",
                });
            }


            /**
             * Ajustar stock.
             */
            await stock.update(
                {
                    quantity:
                        Number(
                            stock.quantity || 0,
                        ) +
                        delta,
                },
                {
                    transaction,
                },
            );


            /**
             * Registrar movimiento del ajuste.
             */
            await GarmentMovement.create(
                {
                    batch_id:
                        batchId,

                    garment_id:
                        item.garment_id,

                    from_status_id:
                        delta < 0
                            ? draftStatus.id
                            : null,

                    to_status_id:
                        delta > 0
                            ? draftStatus.id
                            : null,

                    quantity:
                        Math.abs(delta),

                    movement_type:
                        delta > 0
                            ? "ajuste_alta_borrador_cliente"
                            : "ajuste_baja_borrador_cliente",

                    created_by:
                        req.user.id,

                    notes:
                        delta > 0
                            ? "Ajuste de aumento de prenda en borrador cliente"
                            : "Ajuste de disminucion de prenda en borrador cliente",
                },
                {
                    transaction,
                },
            );
        }


        await transaction.commit();


        return res.json({
            ok: true,
            message:
                "Prenda del lote actualizada correctamente",
            data: item,
        });

    } catch (error) {
        await transaction.rollback();

        console.error(error);

        return res.status(500).json({
            ok: false,
            message:
                "Error actualizando prenda del lote",
        });
    }
}


/**
 * DELETE /batches/:batchId/items/:itemId
 *
 * Elimina una prenda de un lote mientras éste
 * todavía se encuentra en BORRADOR_CLIENTE.
 */
export async function removeBatchItem(
    req: Request,
    res: Response,
) {
    const transaction =
        await sequelize.transaction();

    try {
        const batchId =
            req.params.batchId as string;

        const itemId =
            req.params.itemId as string;


        if (!req.user) {
            await transaction.rollback();

            return res.status(401).json({
                ok: false,
                message:
                    "Usuario no autenticado",
            });
        }


        /**
         * Buscar item.
         */
        const item =
            await GarmentBatchItem.findOne({
                where: {
                    id: itemId,
                    batch_id: batchId,
                },

                transaction,

                lock:
                    transaction.LOCK.UPDATE,
            });


        if (!item) {
            await transaction.rollback();

            return res.status(404).json({
                ok: false,
                message:
                    "Prenda del lote no encontrada",
            });
        }


        /**
         * Validar lote.
         */
        const validation =
            await assertBatchEditableByClient(
                batchId,
                req,
                transaction,
            );


        if (!validation.ok) {
            await transaction.rollback();

            return res
                .status(validation.status)
                .json({
                    ok: false,
                    message:
                        validation.message,
                });
        }


        const batch =
            validation.batch!;


        if (!batch) {
            await transaction.rollback();

            return res.status(404).json({
                ok: false,
                message:
                    "Lote no encontrado",
            });
        }


        if (
            isClientOperator(req) &&
            batch.client_id !==
            req.user?.client_id
        ) {
            await transaction.rollback();

            return res.status(403).json({
                ok: false,
                message:
                    "No puedes modificar lotes de otro cliente",
            });
        }


        /**
         * Estado borrador.
         */
        const draftStatus =
            await MovementStatus.findOne({
                where: {
                    code:
                        "BORRADOR_CLIENTE",
                },

                transaction,
            });


        if (!draftStatus) {
            await transaction.rollback();

            return res.status(500).json({
                ok: false,
                message:
                    "No existe estado BORRADOR_CLIENTE para anular item",
            });
        }


        const quantity =
            Number(
                item.quantity_sent || 0,
            );


        /**
         * Buscar stock.
         */
        const stock =
            await GarmentStock.findOne({
                where: {
                    client_id:
                        batch.client_id,

                    garment_id:
                        item.garment_id,

                    status_id:
                        draftStatus.id,
                },

                transaction,

                lock:
                    transaction.LOCK.UPDATE,
            });


        if (
            !stock ||
            Number(
                stock.quantity || 0,
            ) < quantity
        ) {
            await transaction.rollback();

            return res.status(400).json({
                ok: false,
                message:
                    "Stock insuficiente en borrador para eliminar el item",
            });
        }


        /**
         * Restar cantidad del stock.
         */
        await stock.update(
            {
                quantity:
                    Number(
                        stock.quantity || 0,
                    ) -
                    quantity,
            },
            {
                transaction,
            },
        );


        /**
         * Registrar movimiento de anulación.
         */
        await GarmentMovement.create(
            {
                batch_id:
                    batchId,

                garment_id:
                    item.garment_id,

                from_status_id:
                    draftStatus.id,

                to_status_id:
                    null,

                quantity,

                movement_type:
                    "anulacion_item_borrador_cliente",

                created_by:
                    req.user.id,

                notes:
                    "Anulacion de prenda en borrador cliente",
            },
            {
                transaction,
            },
        );


        /**
         * Eliminar item.
         */
        await item.destroy({
            transaction,
        });


        await transaction.commit();


        return res.json({
            ok: true,
            message:
                "Prenda eliminada del lote correctamente",
        });

    } catch (error) {
        await transaction.rollback();

        console.error(error);

        return res.status(500).json({
            ok: false,
            message:
                "Error eliminando prenda del lote",
        });
    }
}
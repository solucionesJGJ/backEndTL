import { Sequelize } from "sequelize";

import { Role, initRoleModel } from "./role.model.js";
import { User, initUserModel } from "./user.model.js";
import { Client, initClientModel } from "./client.model.js";
import { Garment, initGarmentModel } from "./garment.model.js";
import {
    MovementStatus,
    initMovementStatusModel,
} from "./movement-status.model.js";
import {
    GarmentBatch,
    initGarmentBatchModel,
} from "./garment-batch.model.js";
import {
    GarmentBatchItem,
    initGarmentBatchItemModel,
} from "./garment-batch-item.model.js";
import {
    GarmentMovement,
    initGarmentMovementModel,
} from "./garment-movement.model.js";
import {
    GarmentStock,
    initGarmentStockModel,
} from "./garment-stock.model.js";
import {
    Vehicle,
    initVehicleModel,
} from "./vehicle.model.js";

import {
    DriverShift,
    initDriverShiftModel,
} from "./driver-shift.model.js";

import {
    DriverShiftCheck,
    initDriverShiftCheckModel,
} from "./driver-shift-check.model.js";
import { initGarmentPriceHistoryModel, GarmentPriceHistory } from "./garment-price-history.model.js";
if (!process.env.DB_NAME || !process.env.DB_USER || !process.env.DB_PASS || !process.env.DB_HOST) {
    throw new Error("Una o más variables de entorno de la base de datos no están definidas");
}

export const sequelize = new Sequelize(process.env.DB_NAME || '', process.env.DB_USER || '', process.env.DB_PASS || '', {
    host: process.env.DB_HOST || '',
    dialect: 'postgres',
    pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000,
    },
    logging: false // o true si quieres ver los queries
});

initRoleModel(sequelize);
initClientModel(sequelize);
initUserModel(sequelize);
initGarmentModel(sequelize);
initMovementStatusModel(sequelize);
initGarmentBatchModel(sequelize);
initGarmentBatchItemModel(sequelize);
initGarmentMovementModel(sequelize);
initGarmentStockModel(sequelize);
initGarmentPriceHistoryModel(sequelize);
initVehicleModel(sequelize);
initDriverShiftModel(sequelize);
initDriverShiftCheckModel(sequelize);

/**
 * Relaciones
 */


/**
 * ROLE ↔ USER
 */

Role.hasMany(User, {
    foreignKey: "role_id",
    as: "users",
});

User.belongsTo(Role, {
    foreignKey: "role_id",
    as: "role",
});


/**
 * CLIENT ↔ USER
 */

Client.hasMany(User, {
    foreignKey: "client_id",
    as: "users",
});

User.belongsTo(Client, {
    foreignKey: "client_id",
    as: "client",
});


/**
 * CLIENT ↔ GARMENT
 */

Client.hasMany(Garment, {
    foreignKey: "client_id",
    as: "garments",
});

Garment.belongsTo(Client, {
    foreignKey: "client_id",
    as: "client",
});


/**
 * GARMENT ↔ PRICE HISTORY
 */

Garment.hasMany(GarmentPriceHistory, {
    foreignKey: "garment_id",
    as: "price_history",
});

GarmentPriceHistory.belongsTo(Garment, {
    foreignKey: "garment_id",
    as: "garment",
});


/**
 * USER ↔ PRICE HISTORY
 */

User.hasMany(GarmentPriceHistory, {
    foreignKey: "changed_by",
    as: "garment_price_changes",
});

GarmentPriceHistory.belongsTo(User, {
    foreignKey: "changed_by",
    as: "changed_by_user",
});


/**
 * CLIENT ↔ GARMENT BATCH
 */

Client.hasMany(GarmentBatch, {
    foreignKey: "client_id",
    as: "batches",
});

GarmentBatch.belongsTo(Client, {
    foreignKey: "client_id",
    as: "client",
});


/**
 * USER ↔ GARMENT BATCH
 */

User.hasMany(GarmentBatch, {
    foreignKey: "created_by",
    as: "created_batches",
});

GarmentBatch.belongsTo(User, {
    foreignKey: "created_by",
    as: "creator",
});


/**
 * MOVEMENT STATUS ↔ GARMENT BATCH
 */

MovementStatus.hasMany(GarmentBatch, {
    foreignKey: "current_status_id",
    as: "batches",
});

GarmentBatch.belongsTo(MovementStatus, {
    foreignKey: "current_status_id",
    as: "current_status",
});


/**
 * GARMENT BATCH ↔ ITEMS
 */

GarmentBatch.hasMany(GarmentBatchItem, {
    foreignKey: "batch_id",
    as: "items",
});

GarmentBatchItem.belongsTo(GarmentBatch, {
    foreignKey: "batch_id",
    as: "batch",
});


/**
 * GARMENT ↔ BATCH ITEMS
 */

Garment.hasMany(GarmentBatchItem, {
    foreignKey: "garment_id",
    as: "batch_items",
});

GarmentBatchItem.belongsTo(Garment, {
    foreignKey: "garment_id",
    as: "garment",
});


/**
 * GARMENT BATCH ↔ MOVEMENTS
 */

GarmentBatch.hasMany(GarmentMovement, {
    foreignKey: "batch_id",
    as: "movements",
});

GarmentMovement.belongsTo(GarmentBatch, {
    foreignKey: "batch_id",
    as: "batch",
});


/**
 * GARMENT ↔ MOVEMENTS
 */

Garment.hasMany(GarmentMovement, {
    foreignKey: "garment_id",
    as: "movements",
});

GarmentMovement.belongsTo(Garment, {
    foreignKey: "garment_id",
    as: "garment",
});


/**
 * MOVEMENT STATUS ↔ MOVEMENTS
 */

MovementStatus.hasMany(GarmentMovement, {
    foreignKey: "from_status_id",
    as: "from_movements",
});

GarmentMovement.belongsTo(MovementStatus, {
    foreignKey: "from_status_id",
    as: "from_status",
});

MovementStatus.hasMany(GarmentMovement, {
    foreignKey: "to_status_id",
    as: "to_movements",
});

GarmentMovement.belongsTo(MovementStatus, {
    foreignKey: "to_status_id",
    as: "to_status",
});


/**
 * USER ↔ MOVEMENTS
 */

User.hasMany(GarmentMovement, {
    foreignKey: "created_by",
    as: "movements",
});

GarmentMovement.belongsTo(User, {
    foreignKey: "created_by",
    as: "creator",
});


/**
 * CLIENT ↔ STOCK
 */

Client.hasMany(GarmentStock, {
    foreignKey: "client_id",
    as: "stock",
});

GarmentStock.belongsTo(Client, {
    foreignKey: "client_id",
    as: "client",
});


/**
 * GARMENT ↔ STOCK
 */

Garment.hasMany(GarmentStock, {
    foreignKey: "garment_id",
    as: "stock",
});

GarmentStock.belongsTo(Garment, {
    foreignKey: "garment_id",
    as: "garment",
});


/**
 * MOVEMENT STATUS ↔ STOCK
 */

MovementStatus.hasMany(GarmentStock, {
    foreignKey: "status_id",
    as: "stock_items",
});

GarmentStock.belongsTo(MovementStatus, {
    foreignKey: "status_id",
    as: "status",
});

/**
 * =========================================================
 * TRANSPORTE / JORNADAS
 * =========================================================
 */


/**
 * USER ↔ DRIVER SHIFT
 *
 * Un transportista puede tener
 * muchas jornadas históricas.
 */
User.hasMany(DriverShift, {
    foreignKey: "user_id",
    as: "driver_shifts",
});

DriverShift.belongsTo(User, {
    foreignKey: "user_id",
    as: "driver",
});


/**
 * VEHICLE ↔ DRIVER SHIFT
 *
 * Un vehículo puede ser utilizado
 * en múltiples jornadas.
 */
Vehicle.hasMany(DriverShift, {
    foreignKey: "vehicle_id",
    as: "driver_shifts",
});

DriverShift.belongsTo(Vehicle, {
    foreignKey: "vehicle_id",
    as: "vehicle",
});


/**
 * DRIVER SHIFT ↔ CHECKS
 *
 * Una jornada guarda todos los
 * resultados de su checklist.
 */
DriverShift.hasMany(
    DriverShiftCheck,
    {
        foreignKey: "shift_id",
        as: "checks",
        onDelete: "CASCADE",
    }
);

DriverShiftCheck.belongsTo(
    DriverShift,
    {
        foreignKey: "shift_id",
        as: "shift",
    }
);


export {
    Role,
    User,
    Client,

    Garment,
    GarmentPriceHistory,

    MovementStatus,

    GarmentBatch,
    GarmentBatchItem,

    GarmentMovement,
    GarmentStock,
    Vehicle,
    DriverShift,
    DriverShiftCheck,
};
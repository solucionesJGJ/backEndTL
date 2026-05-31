import { Sequelize } from "sequelize";

import { Role, initRoleModel } from "./role.model.js";
import { User, initUserModel } from "./user.model.js";
import { Client, initClientModel } from "./client.model.js";
import { GarmentType, initGarmentTypeModel } from "./garment-type.model.js";
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
initGarmentTypeModel(sequelize);
initGarmentModel(sequelize);
initMovementStatusModel(sequelize);
initGarmentBatchModel(sequelize);
initGarmentBatchItemModel(sequelize);
initGarmentMovementModel(sequelize);
initGarmentStockModel(sequelize);

/**
 * Relaciones
 */

Role.hasMany(User, {
    foreignKey: "role_id",
    as: "users",
});
User.belongsTo(Role, {
    foreignKey: "role_id",
    as: "role",
});

Client.hasMany(User, {
    foreignKey: "client_id",
    as: "users",
});
User.belongsTo(Client, {
    foreignKey: "client_id",
    as: "client",
});

Client.hasMany(Garment, {
    foreignKey: "client_id",
    as: "garments",
});
Garment.belongsTo(Client, {
    foreignKey: "client_id",
    as: "client",
});

GarmentType.hasMany(Garment, {
    foreignKey: "garment_type_id",
    as: "garments",
});
Garment.belongsTo(GarmentType, {
    foreignKey: "garment_type_id",
    as: "type",
});

Client.hasMany(GarmentBatch, {
    foreignKey: "client_id",
    as: "batches",
});
GarmentBatch.belongsTo(Client, {
    foreignKey: "client_id",
    as: "client",
});

User.hasMany(GarmentBatch, {
    foreignKey: "created_by",
    as: "created_batches",
});
GarmentBatch.belongsTo(User, {
    foreignKey: "created_by",
    as: "creator",
});

MovementStatus.hasMany(GarmentBatch, {
    foreignKey: "current_status_id",
    as: "batches",
});
GarmentBatch.belongsTo(MovementStatus, {
    foreignKey: "current_status_id",
    as: "current_status",
});

GarmentBatch.hasMany(GarmentBatchItem, {
    foreignKey: "batch_id",
    as: "items",
});
GarmentBatchItem.belongsTo(GarmentBatch, {
    foreignKey: "batch_id",
    as: "batch",
});

Garment.hasMany(GarmentBatchItem, {
    foreignKey: "garment_id",
    as: "batch_items",
});
GarmentBatchItem.belongsTo(Garment, {
    foreignKey: "garment_id",
    as: "garment",
});

GarmentBatch.hasMany(GarmentMovement, {
    foreignKey: "batch_id",
    as: "movements",
});
GarmentMovement.belongsTo(GarmentBatch, {
    foreignKey: "batch_id",
    as: "batch",
});

Garment.hasMany(GarmentMovement, {
    foreignKey: "garment_id",
    as: "movements",
});
GarmentMovement.belongsTo(Garment, {
    foreignKey: "garment_id",
    as: "garment",
});

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

User.hasMany(GarmentMovement, {
    foreignKey: "created_by",
    as: "movements",
});
GarmentMovement.belongsTo(User, {
    foreignKey: "created_by",
    as: "creator",
});

Client.hasMany(GarmentStock, {
    foreignKey: "client_id",
    as: "stock",
});
GarmentStock.belongsTo(Client, {
    foreignKey: "client_id",
    as: "client",
});

Garment.hasMany(GarmentStock, {
    foreignKey: "garment_id",
    as: "stock",
});
GarmentStock.belongsTo(Garment, {
    foreignKey: "garment_id",
    as: "garment",
});

MovementStatus.hasMany(GarmentStock, {
    foreignKey: "status_id",
    as: "stock_items",
});
GarmentStock.belongsTo(MovementStatus, {
    foreignKey: "status_id",
    as: "status",
});

export {
    Role,
    User,
    Client,
    GarmentType,
    Garment,
    MovementStatus,
    GarmentBatch,
    GarmentBatchItem,
    GarmentMovement,
    GarmentStock,
};
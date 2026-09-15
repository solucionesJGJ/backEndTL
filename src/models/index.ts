import { Sequelize } from "sequelize";

import { Client, initClientModel } from "./client.model.js";
import {
  GarmentBatchItem,
  initGarmentBatchItemModel,
} from "./garment-batch-item.model.js";
import { GarmentBatch, initGarmentBatchModel } from "./garment-batch.model.js";
import {
  GarmentIncident,
  initGarmentIncidentModel,
} from "./garment-incident.model.js";
import {
  GarmentMovement,
  initGarmentMovementModel,
} from "./garment-movement.model.js";
import { GarmentStock, initGarmentStockModel } from "./garment-stock.model.js";
import { Garment, initGarmentModel } from "./garment.model.js";
import {
  MovementStatus,
  initMovementStatusModel,
} from "./movement-status.model.js";
import { Role, initRoleModel } from "./role.model.js";
import { User, initUserModel } from "./user.model.js";
import { Vehicle, initVehicleModel } from "./vehicle.model.js";

import { DriverShift, initDriverShiftModel } from "./driver-shift.model.js";

import {
  BillingDocument,
  initBillingDocumentModel,
} from "./billing-document.model.js";
import {
  DriverShiftCheck,
  initDriverShiftCheckModel,
} from "./driver-shift-check.model.js";
import {
  GarmentPriceHistory,
  initGarmentPriceHistoryModel,
} from "./garment-price-history.model.js";

import {
  BillingDocumentBatch,
  initBillingDocumentBatchModel,
} from "./billing-document-batch.model.js";

import {
  BillingDocumentItem,
  initBillingDocumentItemModel,
} from "./billing-document-item.model.js";

import {
  DispatchGuide,
  initDispatchGuideModel,
} from "./dispatch-guide.model.js";

import {
  DispatchGuideItem,
  initDispatchGuideItemModel,
} from "./dispatch-guide-item.model.js";

import {
  ClientEconomicActivity,
  initClientEconomicActivityModel,
} from "./client-economic-activity.model.js";

import {
  EconomicActivity,
  initEconomicActivityModel,
} from "./economic-activity.model.js";

if (
  !process.env.DB_NAME ||
  !process.env.DB_USER ||
  !process.env.DB_PASS ||
  !process.env.DB_HOST
) {
  throw new Error(
    "Una o más variables de entorno de la base de datos no están definidas",
  );
}

export const sequelize = new Sequelize(
  process.env.DB_NAME || "",
  process.env.DB_USER || "",
  process.env.DB_PASS || "",
  {
    host: process.env.DB_HOST || "",
    dialect: "postgres",
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
    logging: false, // o true si quieres ver los queries
  },
);

initRoleModel(sequelize);
initClientModel(sequelize);
initEconomicActivityModel(sequelize);
initClientEconomicActivityModel(sequelize);
initUserModel(sequelize);
initGarmentModel(sequelize);
initMovementStatusModel(sequelize);
initGarmentBatchModel(sequelize);
initGarmentBatchItemModel(sequelize);
initGarmentMovementModel(sequelize);
initGarmentIncidentModel(sequelize);
initGarmentStockModel(sequelize);
initGarmentPriceHistoryModel(sequelize);
initVehicleModel(sequelize);
initDriverShiftModel(sequelize);
initDriverShiftCheckModel(sequelize);
initBillingDocumentModel(sequelize);
initBillingDocumentBatchModel(sequelize);
initBillingDocumentItemModel(sequelize);
initDispatchGuideModel(sequelize);
initDispatchGuideItemModel(sequelize);

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
 * =========================================================
 * INCIDENCIAS DE PRENDAS
 * =========================================================
 */

GarmentBatch.hasMany(GarmentIncident, {
  foreignKey: "batch_id",
  as: "incidents",
});

GarmentIncident.belongsTo(GarmentBatch, {
  foreignKey: "batch_id",
  as: "batch",
});

Garment.hasMany(GarmentIncident, {
  foreignKey: "garment_id",
  as: "incidents",
});

GarmentIncident.belongsTo(Garment, {
  foreignKey: "garment_id",
  as: "garment",
});

GarmentMovement.hasOne(GarmentIncident, {
  foreignKey: "movement_id",
  as: "incident",
});

GarmentIncident.belongsTo(GarmentMovement, {
  foreignKey: "movement_id",
  as: "movement",
});

MovementStatus.hasMany(GarmentIncident, {
  foreignKey: "origin_status_id",
  as: "origin_incidents",
});

GarmentIncident.belongsTo(MovementStatus, {
  foreignKey: "origin_status_id",
  as: "origin_status",
});

User.hasMany(GarmentIncident, {
  foreignKey: "created_by",
  as: "created_incidents",
});

GarmentIncident.belongsTo(User, {
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
DriverShift.hasMany(DriverShiftCheck, {
  foreignKey: "shift_id",
  as: "checks",
  onDelete: "CASCADE",
});

DriverShiftCheck.belongsTo(DriverShift, {
  foreignKey: "shift_id",
  as: "shift",
});

/**
 * =========================================================
 * FACTURACION
 * =========================================================
 */

/**
 * CLIENT ↔ BILLING DOCUMENT
 */
Client.hasMany(BillingDocument, {
  foreignKey: "client_id",
  as: "billing_documents",
});

BillingDocument.belongsTo(Client, {
  foreignKey: "client_id",
  as: "client",
});

/**
 * USER ↔ BILLING DOCUMENT
 *
 * Usuario administrador que creó
 * la facturación.
 */
User.hasMany(BillingDocument, {
  foreignKey: "created_by",
  as: "created_billing_documents",
});

BillingDocument.belongsTo(User, {
  foreignKey: "created_by",
  as: "creator",
});

/**
 * BILLING DOCUMENT ↔ DOCUMENT BATCH
 */
BillingDocument.hasMany(BillingDocumentBatch, {
  foreignKey: "billing_document_id",

  as: "batches",

  onDelete: "CASCADE",
});

BillingDocumentBatch.belongsTo(BillingDocument, {
  foreignKey: "billing_document_id",

  as: "billing_document",
});

/**
 * GARMENT BATCH ↔ BILLING DOCUMENT BATCH
 */
GarmentBatch.hasMany(BillingDocumentBatch, {
  foreignKey: "batch_id",

  as: "billing_records",
});

BillingDocumentBatch.belongsTo(GarmentBatch, {
  foreignKey: "batch_id",

  as: "batch",
});

/**
 * BILLING DOCUMENT ↔ ITEMS
 */
BillingDocument.hasMany(BillingDocumentItem, {
  foreignKey: "billing_document_id",

  as: "items",

  onDelete: "CASCADE",
});

BillingDocumentItem.belongsTo(BillingDocument, {
  foreignKey: "billing_document_id",

  as: "billing_document",
});

/**
 * GARMENT BATCH ↔ BILLING ITEMS
 */
GarmentBatch.hasMany(BillingDocumentItem, {
  foreignKey: "batch_id",

  as: "billing_items",
});

BillingDocumentItem.belongsTo(GarmentBatch, {
  foreignKey: "batch_id",

  as: "batch",
});

/**
 * GARMENT ↔ BILLING ITEMS
 */
Garment.hasMany(BillingDocumentItem, {
  foreignKey: "garment_id",

  as: "billing_items",
});

BillingDocumentItem.belongsTo(Garment, {
  foreignKey: "garment_id",

  as: "garment",
});

/**
 * =========================================================
 * GUÍAS DE DESPACHO DTE52
 * =========================================================
 */

/**
 * GARMENT BATCH ↔ DISPATCH GUIDE
 *
 * Un lote puede tener como máximo una guía
 * dentro del flujo actual.
 */
GarmentBatch.hasOne(DispatchGuide, {
  foreignKey: "batch_id",

  as: "dispatch_guide",
});

DispatchGuide.belongsTo(GarmentBatch, {
  foreignKey: "batch_id",

  as: "batch",
});

/**
 * CLIENT ↔ DISPATCH GUIDE
 */
Client.hasMany(DispatchGuide, {
  foreignKey: "client_id",

  as: "dispatch_guides",
});

DispatchGuide.belongsTo(Client, {
  foreignKey: "client_id",

  as: "client",
});

/**
 * DRIVER SHIFT ↔ DISPATCH GUIDE
 */
DriverShift.hasMany(DispatchGuide, {
  foreignKey: "driver_shift_id",

  as: "dispatch_guides",
});

DispatchGuide.belongsTo(DriverShift, {
  foreignKey: "driver_shift_id",

  as: "driver_shift",
});

/**
 * DRIVER USER ↔ DISPATCH GUIDE
 */
User.hasMany(DispatchGuide, {
  foreignKey: "driver_user_id",

  as: "assigned_dispatch_guides",
});

DispatchGuide.belongsTo(User, {
  foreignKey: "driver_user_id",

  as: "assigned_driver",
});

/**
 * VEHICLE ↔ DISPATCH GUIDE
 */
Vehicle.hasMany(DispatchGuide, {
  foreignKey: "vehicle_id",

  as: "dispatch_guides",
});

DispatchGuide.belongsTo(Vehicle, {
  foreignKey: "vehicle_id",

  as: "vehicle",
});

/**
 * REQUESTER USER ↔ DISPATCH GUIDE
 */
User.hasMany(DispatchGuide, {
  foreignKey: "requested_by",

  as: "requested_dispatch_guides",
});

DispatchGuide.belongsTo(User, {
  foreignKey: "requested_by",

  as: "requester",
});

/**
 * DISPATCH GUIDE ↔ ITEMS
 */
DispatchGuide.hasMany(DispatchGuideItem, {
  foreignKey: "dispatch_guide_id",

  as: "items",

  onDelete: "CASCADE",
});

DispatchGuideItem.belongsTo(DispatchGuide, {
  foreignKey: "dispatch_guide_id",

  as: "dispatch_guide",
});

/**
 * GARMENT ↔ DISPATCH GUIDE ITEMS
 */
Garment.hasMany(DispatchGuideItem, {
  foreignKey: "garment_id",

  as: "dispatch_guide_items",
});

DispatchGuideItem.belongsTo(Garment, {
  foreignKey: "garment_id",

  as: "garment",
});

/**
 * GARMENT MOVEMENT ↔ DISPATCH GUIDE ITEM
 *
 * El movimiento puede asociarse posteriormente,
 * cuando se registre PREPARADO_DESPACHO
 * -> EN_TRASLADO.
 */
GarmentMovement.hasOne(DispatchGuideItem, {
  foreignKey: "movement_id",

  as: "dispatch_guide_item",
});

DispatchGuideItem.belongsTo(GarmentMovement, {
  foreignKey: "movement_id",

  as: "movement",
});

/**
 * =========================================================
 * CLIENT ↔ ECONOMIC ACTIVITY
 * =========================================================
 */

Client.hasMany(ClientEconomicActivity, {
  foreignKey: "client_id",
  as: "economic_activity_links",
  onDelete: "CASCADE",
});

ClientEconomicActivity.belongsTo(Client, {
  foreignKey: "client_id",
  as: "client",
});

EconomicActivity.hasMany(ClientEconomicActivity, {
  foreignKey: "economic_activity_id",
  as: "client_links",
});

ClientEconomicActivity.belongsTo(EconomicActivity, {
  foreignKey: "economic_activity_id",
  as: "economic_activity",
});

Client.belongsToMany(EconomicActivity, {
  through: ClientEconomicActivity,
  foreignKey: "client_id",
  otherKey: "economic_activity_id",
  as: "economic_activities",
});

EconomicActivity.belongsToMany(Client, {
  through: ClientEconomicActivity,
  foreignKey: "economic_activity_id",
  otherKey: "client_id",
  as: "clients",
});

export {
  BillingDocument,
  BillingDocumentBatch,
  BillingDocumentItem,
  Client,
  ClientEconomicActivity,
  EconomicActivity,
  DispatchGuide,
  DispatchGuideItem,
  DriverShift,
  DriverShiftCheck,
  Garment,
  GarmentBatch,
  GarmentBatchItem,
  GarmentIncident,
  GarmentMovement,
  GarmentPriceHistory,
  GarmentStock,
  MovementStatus,
  Role,
  User,
  Vehicle,
};

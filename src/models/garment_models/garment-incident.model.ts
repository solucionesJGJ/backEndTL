import {
  DataTypes,
  Model,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from "sequelize";

export type GarmentIncidentReason =
  "NOT_RECEIVED" | "MISSING" | "DAMAGED" | "DISPATCH_DIFFERENCE" | "OTHER";

export type GarmentIncidentResolutionStatus = "OPEN" | "RESOLVED";

export type GarmentIncidentBillingResolution =
  "PENDING_REVIEW" | "BILLABLE" | "NON_BILLABLE";

export class GarmentIncident extends Model<
  InferAttributes<GarmentIncident>,
  InferCreationAttributes<GarmentIncident>
> {
  declare id: CreationOptional<string>;
  declare batch_id: string;
  declare garment_id: string;
  declare movement_id: string;
  declare origin_status_id: string;
  declare quantity: number;
  declare reason: GarmentIncidentReason;
  declare description: string | null;
  declare resolution_status: CreationOptional<GarmentIncidentResolutionStatus>;
  declare billing_resolution: CreationOptional<GarmentIncidentBillingResolution>;
  declare created_by: string;
  declare resolved_at: Date | null;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

export function initGarmentIncidentModel(
  sequelize: Sequelize,
): typeof GarmentIncident {
  GarmentIncident.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      batch_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      garment_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      movement_id: {
        type: DataTypes.UUID,
        allowNull: false,
        unique: true,
      },
      origin_status_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      quantity: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: { min: 1 },
      },
      reason: {
        type: DataTypes.ENUM(
          "NOT_RECEIVED",
          "MISSING",
          "DAMAGED",
          "DISPATCH_DIFFERENCE",
          "OTHER",
        ),
        allowNull: false,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      resolution_status: {
        type: DataTypes.ENUM("OPEN", "RESOLVED"),
        allowNull: false,
        defaultValue: "RESOLVED",
      },
      billing_resolution: {
        type: DataTypes.ENUM("PENDING_REVIEW", "BILLABLE", "NON_BILLABLE"),
        allowNull: false,
        defaultValue: "PENDING_REVIEW",
      },
      created_by: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      resolved_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      createdAt: {
        type: DataTypes.DATE,
        field: "created_at",
      },
      updatedAt: {
        type: DataTypes.DATE,
        field: "updated_at",
      },
    },
    {
      sequelize,
      tableName: "garment_incidents",
      timestamps: true,
      underscored: true,
      indexes: [
        { fields: ["batch_id"] },
        { fields: ["garment_id"] },
        { fields: ["origin_status_id"] },
        { fields: ["created_by"] },
      ],
    },
  );

  return GarmentIncident;
}

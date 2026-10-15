import { DataTypes, Model, type CreationOptional, type InferAttributes, type InferCreationAttributes, type Sequelize } from "sequelize";

export class PosCashMovement extends Model<InferAttributes<PosCashMovement>, InferCreationAttributes<PosCashMovement>> {
  declare id: CreationOptional<string>;
  declare session_id: string;
  declare request_id: string;
  declare created_by: string;
  declare type: "CASH_IN" | "CASH_OUT";
  declare amount_clp: number;
  declare reason: string;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

export function initPosCashMovementModel(sequelize: Sequelize): typeof PosCashMovement {
  PosCashMovement.init({
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    session_id: { type: DataTypes.UUID, allowNull: false },
    request_id: { type: DataTypes.UUID, allowNull: false, unique: true },
    created_by: { type: DataTypes.UUID, allowNull: false },
    type: { type: DataTypes.ENUM("CASH_IN", "CASH_OUT"), allowNull: false },
    amount_clp: { type: DataTypes.INTEGER, allowNull: false, validate: { min: 1 } },
    reason: { type: DataTypes.STRING(500), allowNull: false },
    createdAt: { type: DataTypes.DATE, field: "created_at" },
    updatedAt: { type: DataTypes.DATE, field: "updated_at" },
  }, { sequelize, tableName: "pos_cash_movements", timestamps: true, underscored: true, indexes: [
    { fields: ["session_id", "created_at"] },
    { fields: ["created_by"] },
  ] });
  return PosCashMovement;
}

import { DataTypes, Model, type CreationOptional, type InferAttributes, type InferCreationAttributes, type Sequelize } from "sequelize";

export class PosSaleReversal extends Model<InferAttributes<PosSaleReversal>, InferCreationAttributes<PosSaleReversal>> {
  declare id: CreationOptional<string>;
  declare sale_id: string;
  declare request_id: string;
  declare type: "VOID" | "REFUND";
  declare reason: string;
  declare amount_clp: number;
  declare refund_method: "CASH" | "CARD" | "TRANSFER" | "OTHER" | null;
  declare refund_reference: string | null;
  declare created_by: string;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

export function initPosSaleReversalModel(sequelize: Sequelize): typeof PosSaleReversal {
  PosSaleReversal.init({
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    sale_id: { type: DataTypes.UUID, allowNull: false, unique: true },
    request_id: { type: DataTypes.UUID, allowNull: false, unique: true },
    type: { type: DataTypes.ENUM("VOID", "REFUND"), allowNull: false },
    reason: { type: DataTypes.STRING(500), allowNull: false },
    amount_clp: { type: DataTypes.INTEGER, allowNull: false, validate: { min: 1 } },
    refund_method: { type: DataTypes.ENUM("CASH", "CARD", "TRANSFER", "OTHER"), allowNull: true },
    refund_reference: { type: DataTypes.STRING(150), allowNull: true },
    created_by: { type: DataTypes.UUID, allowNull: false },
    createdAt: { type: DataTypes.DATE, field: "created_at" },
    updatedAt: { type: DataTypes.DATE, field: "updated_at" },
  }, { sequelize, tableName: "pos_sale_reversals", timestamps: true, underscored: true, indexes: [{ fields: ["created_at"] }, { fields: ["created_by"] }] });
  return PosSaleReversal;
}

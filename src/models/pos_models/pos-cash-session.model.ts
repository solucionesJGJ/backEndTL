import { DataTypes, Model, type CreationOptional, type InferAttributes, type InferCreationAttributes, type Sequelize } from "sequelize";

export class PosCashSession extends Model<InferAttributes<PosCashSession>, InferCreationAttributes<PosCashSession>> {
  declare id: CreationOptional<string>;
  declare organization_id: string;
  declare location_id: string;
  declare terminal_id: string;
  declare opened_by: string;
  declare closed_by: string | null;
  declare status: CreationOptional<"OPEN" | "CLOSED">;
  declare opening_cash_clp: number;
  declare expected_cash_clp: number | null;
  declare counted_cash_clp: number | null;
  declare difference_clp: number | null;
  declare opening_note: string | null;
  declare closing_note: string | null;
  declare opened_at: CreationOptional<Date>;
  declare closed_at: Date | null;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

export function initPosCashSessionModel(sequelize: Sequelize): typeof PosCashSession {
  PosCashSession.init({
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    organization_id: { type: DataTypes.UUID, allowNull: false },
    location_id: { type: DataTypes.UUID, allowNull: false },
    terminal_id: { type: DataTypes.UUID, allowNull: false },
    opened_by: { type: DataTypes.UUID, allowNull: false },
    closed_by: { type: DataTypes.UUID, allowNull: true },
    status: { type: DataTypes.ENUM("OPEN", "CLOSED"), allowNull: false, defaultValue: "OPEN" },
    opening_cash_clp: { type: DataTypes.INTEGER, allowNull: false, validate: { min: 0 } },
    expected_cash_clp: { type: DataTypes.INTEGER, allowNull: true },
    counted_cash_clp: { type: DataTypes.INTEGER, allowNull: true, validate: { min: 0 } },
    difference_clp: { type: DataTypes.INTEGER, allowNull: true },
    opening_note: { type: DataTypes.STRING(500), allowNull: true },
    closing_note: { type: DataTypes.STRING(500), allowNull: true },
    opened_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    closed_at: { type: DataTypes.DATE, allowNull: true },
    createdAt: { type: DataTypes.DATE, field: "created_at" },
    updatedAt: { type: DataTypes.DATE, field: "updated_at" },
  }, { sequelize, tableName: "pos_cash_sessions", timestamps: true, underscored: true, indexes: [
    { fields: ["terminal_id", "opened_at"] },
    { fields: ["location_id", "opened_at"] },
    { fields: ["status"] },
  ] });
  return PosCashSession;
}

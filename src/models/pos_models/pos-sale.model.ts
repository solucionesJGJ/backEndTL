import {
  DataTypes,
  Model,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from "sequelize";
export class PosSale extends Model<
  InferAttributes<PosSale>,
  InferCreationAttributes<PosSale>
> {
  declare id: CreationOptional<string>;
  declare organization_id: string;
  declare location_id: string;
  declare terminal_id: string;
  declare cash_session_id: string | null;
  declare created_by: string;
  declare request_id: string;
  declare status: CreationOptional<"PAID">;
  declare subtotal_clp: number;
  declare total_clp: number;
  declare paid_clp: number;
  declare change_clp: number;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}
export function initPosSaleModel(sequelize: Sequelize): typeof PosSale {
  PosSale.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      organization_id: { type: DataTypes.UUID, allowNull: false },
      location_id: { type: DataTypes.UUID, allowNull: false },
      terminal_id: { type: DataTypes.UUID, allowNull: false },
      cash_session_id: { type: DataTypes.UUID, allowNull: true },
      created_by: { type: DataTypes.UUID, allowNull: false },
      request_id: { type: DataTypes.UUID, allowNull: false, unique: true },
      status: {
        type: DataTypes.ENUM("PAID"),
        allowNull: false,
        defaultValue: "PAID",
      },
      subtotal_clp: { type: DataTypes.INTEGER, allowNull: false },
      total_clp: { type: DataTypes.INTEGER, allowNull: false },
      paid_clp: { type: DataTypes.INTEGER, allowNull: false },
      change_clp: { type: DataTypes.INTEGER, allowNull: false },
      createdAt: { type: DataTypes.DATE, field: "created_at" },
      updatedAt: { type: DataTypes.DATE, field: "updated_at" },
    },
    {
      sequelize,
      tableName: "pos_sales",
      timestamps: true,
      underscored: true,
      indexes: [
        { fields: ["organization_id", "created_at"] },
        { fields: ["location_id", "created_at"] },
        { fields: ["terminal_id", "created_at"] },
        { fields: ["cash_session_id"] },
      ],
    },
  );
  return PosSale;
}

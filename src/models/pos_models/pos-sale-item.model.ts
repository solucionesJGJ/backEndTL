import {
  DataTypes,
  Model,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from "sequelize";
export class PosSaleItem extends Model<
  InferAttributes<PosSaleItem>,
  InferCreationAttributes<PosSaleItem>
> {
  declare id: CreationOptional<string>;
  declare sale_id: string;
  declare item_id: string;
  declare item_code: string;
  declare item_name: string;
  declare item_type: "PRODUCT" | "SERVICE";
  declare quantity: number;
  declare unit_price_clp: number;
  declare line_total_clp: number;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}
export function initPosSaleItemModel(sequelize: Sequelize): typeof PosSaleItem {
  PosSaleItem.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      sale_id: { type: DataTypes.UUID, allowNull: false },
      item_id: { type: DataTypes.UUID, allowNull: false },
      item_code: { type: DataTypes.STRING(50), allowNull: false },
      item_name: { type: DataTypes.STRING(150), allowNull: false },
      item_type: {
        type: DataTypes.ENUM("PRODUCT", "SERVICE"),
        allowNull: false,
      },
      quantity: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: { min: 1 },
      },
      unit_price_clp: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: { min: 0 },
      },
      line_total_clp: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: { min: 0 },
      },
      createdAt: { type: DataTypes.DATE, field: "created_at" },
      updatedAt: { type: DataTypes.DATE, field: "updated_at" },
    },
    {
      sequelize,
      tableName: "pos_sale_items",
      timestamps: true,
      underscored: true,
      indexes: [{ fields: ["sale_id"] }],
    },
  );
  return PosSaleItem;
}

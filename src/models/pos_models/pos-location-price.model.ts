import {
  DataTypes,
  Model,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from "sequelize";
export class PosLocationPrice extends Model<
  InferAttributes<PosLocationPrice>,
  InferCreationAttributes<PosLocationPrice>
> {
  declare id: CreationOptional<string>;
  declare location_id: string;
  declare item_id: string;
  declare price_clp: number;
  declare active: CreationOptional<boolean>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}
export function initPosLocationPriceModel(
  sequelize: Sequelize,
): typeof PosLocationPrice {
  PosLocationPrice.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      location_id: { type: DataTypes.UUID, allowNull: false },
      item_id: { type: DataTypes.UUID, allowNull: false },
      price_clp: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: { min: 0 },
      },
      active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      createdAt: { type: DataTypes.DATE, field: "created_at" },
      updatedAt: { type: DataTypes.DATE, field: "updated_at" },
    },
    {
      sequelize,
      tableName: "pos_location_prices",
      timestamps: true,
      underscored: true,
      indexes: [
        { unique: true, fields: ["location_id", "item_id"] },
        { fields: ["item_id"] },
      ],
    },
  );
  return PosLocationPrice;
}

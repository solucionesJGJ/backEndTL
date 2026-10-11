import {
  DataTypes,
  Model,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from "sequelize";
export class PosItem extends Model<
  InferAttributes<PosItem>,
  InferCreationAttributes<PosItem>
> {
  declare id: CreationOptional<string>;
  declare organization_id: string;
  declare category_id: string | null;
  declare name: string;
  declare code: string;
  declare description: string | null;
  declare item_type: "PRODUCT" | "SERVICE";
  declare price_clp: number;
  declare active: CreationOptional<boolean>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}
export function initPosItemModel(sequelize: Sequelize): typeof PosItem {
  PosItem.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      organization_id: { type: DataTypes.UUID, allowNull: false },
      category_id: { type: DataTypes.UUID, allowNull: true },
      name: { type: DataTypes.STRING(150), allowNull: false },
      code: { type: DataTypes.STRING(50), allowNull: false },
      description: { type: DataTypes.TEXT, allowNull: true },
      item_type: {
        type: DataTypes.ENUM("PRODUCT", "SERVICE"),
        allowNull: false,
      },
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
      tableName: "pos_items",
      timestamps: true,
      underscored: true,
      indexes: [
        { unique: true, fields: ["organization_id", "code"] },
        { fields: ["category_id"] },
      ],
    },
  );
  return PosItem;
}

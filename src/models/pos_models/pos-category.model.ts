import {
  DataTypes,
  Model,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from "sequelize";
export class PosCategory extends Model<
  InferAttributes<PosCategory>,
  InferCreationAttributes<PosCategory>
> {
  declare id: CreationOptional<string>;
  declare organization_id: string;
  declare name: string;
  declare code: string;
  declare active: CreationOptional<boolean>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}
export function initPosCategoryModel(sequelize: Sequelize): typeof PosCategory {
  PosCategory.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      organization_id: { type: DataTypes.UUID, allowNull: false },
      name: { type: DataTypes.STRING(150), allowNull: false },
      code: { type: DataTypes.STRING(50), allowNull: false },
      active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      createdAt: { type: DataTypes.DATE, field: "created_at" },
      updatedAt: { type: DataTypes.DATE, field: "updated_at" },
    },
    {
      sequelize,
      tableName: "pos_categories",
      timestamps: true,
      underscored: true,
      indexes: [{ unique: true, fields: ["organization_id", "code"] }],
    },
  );
  return PosCategory;
}

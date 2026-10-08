import {
  DataTypes,
  Model,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from "sequelize";

export class PosLocation extends Model<
  InferAttributes<PosLocation>,
  InferCreationAttributes<PosLocation>
> {
  declare id: CreationOptional<string>;
  declare organization_id: string;
  declare tax_profile_id: string | null;
  declare name: string;
  declare code: string;
  declare address: string | null;
  declare commune: string | null;
  declare city: string | null;
  declare active: CreationOptional<boolean>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

export function initPosLocationModel(sequelize: Sequelize): typeof PosLocation {
  PosLocation.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      organization_id: { type: DataTypes.UUID, allowNull: false },
      tax_profile_id: { type: DataTypes.UUID, allowNull: true },
      name: { type: DataTypes.STRING(150), allowNull: false },
      code: { type: DataTypes.STRING(50), allowNull: false },
      address: { type: DataTypes.TEXT, allowNull: true },
      commune: { type: DataTypes.STRING(100), allowNull: true },
      city: { type: DataTypes.STRING(100), allowNull: true },
      active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      createdAt: { type: DataTypes.DATE, field: "created_at" },
      updatedAt: { type: DataTypes.DATE, field: "updated_at" },
    },
    {
      sequelize,
      tableName: "pos_locations",
      timestamps: true,
      underscored: true,
      indexes: [
        { fields: ["organization_id"] },
        { fields: ["tax_profile_id"] },
        { unique: true, fields: ["organization_id", "code"] },
      ],
    },
  );
  return PosLocation;
}

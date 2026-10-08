import {
  DataTypes,
  Model,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from "sequelize";

export class PosOrganization extends Model<
  InferAttributes<PosOrganization>,
  InferCreationAttributes<PosOrganization>
> {
  declare id: CreationOptional<string>;
  declare name: string;
  declare code: string;
  declare active: CreationOptional<boolean>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

export function initPosOrganizationModel(
  sequelize: Sequelize,
): typeof PosOrganization {
  PosOrganization.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      name: { type: DataTypes.STRING(150), allowNull: false },
      code: { type: DataTypes.STRING(50), allowNull: false, unique: true },
      active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      createdAt: { type: DataTypes.DATE, field: "created_at" },
      updatedAt: { type: DataTypes.DATE, field: "updated_at" },
    },
    {
      sequelize,
      tableName: "pos_organizations",
      timestamps: true,
      underscored: true,
      indexes: [
        { unique: true, fields: ["code"] },
        { fields: ["name"] },
      ],
    },
  );
  return PosOrganization;
}

import {
  DataTypes,
  Model,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from "sequelize";

export class PosTaxProfile extends Model<
  InferAttributes<PosTaxProfile>,
  InferCreationAttributes<PosTaxProfile>
> {
  declare id: CreationOptional<string>;
  declare organization_id: string;
  declare name: string;
  declare rut: string;
  declare legal_name: string;
  declare business_activity: string | null;
  declare address: string | null;
  declare commune: string | null;
  declare city: string | null;
  declare dte_email: string | null;
  declare active: CreationOptional<boolean>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

export function initPosTaxProfileModel(
  sequelize: Sequelize,
): typeof PosTaxProfile {
  PosTaxProfile.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      organization_id: { type: DataTypes.UUID, allowNull: false },
      name: { type: DataTypes.STRING(150), allowNull: false },
      rut: { type: DataTypes.STRING(20), allowNull: false },
      legal_name: { type: DataTypes.STRING(200), allowNull: false },
      business_activity: { type: DataTypes.STRING(500), allowNull: true },
      address: { type: DataTypes.TEXT, allowNull: true },
      commune: { type: DataTypes.STRING(100), allowNull: true },
      city: { type: DataTypes.STRING(100), allowNull: true },
      dte_email: { type: DataTypes.STRING(150), allowNull: true },
      active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      createdAt: { type: DataTypes.DATE, field: "created_at" },
      updatedAt: { type: DataTypes.DATE, field: "updated_at" },
    },
    {
      sequelize,
      tableName: "pos_tax_profiles",
      timestamps: true,
      underscored: true,
      indexes: [
        { fields: ["organization_id"] },
        { unique: true, fields: ["organization_id", "rut"] },
      ],
    },
  );
  return PosTaxProfile;
}

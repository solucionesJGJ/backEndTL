import {
  DataTypes,
  Model,
  type Sequelize,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
} from "sequelize";

export class GarmentProcess extends Model<
  InferAttributes<GarmentProcess>,
  InferCreationAttributes<GarmentProcess>
> {
  declare id: CreationOptional<string>;
  declare name: string;
  declare code: string;
  declare percentage: CreationOptional<number>;
  declare active: CreationOptional<boolean>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

export function initGarmentProcessModel(
  sequelize: Sequelize
): typeof GarmentProcess {
  GarmentProcess.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true,
      },
      code: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true,
      },
      percentage: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 0,
      },
      active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      createdAt: {
        type: DataTypes.DATE,
        field: "created_at",
      },
      updatedAt: {
        type: DataTypes.DATE,
        field: "updated_at",
      },
    },
    {
      sequelize,
      tableName: "garment_processes",
      timestamps: true,
      underscored: true,
    }
  );

  return GarmentProcess;
}
import {
  DataTypes,
  Model,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from "sequelize";

export class PosTerminal extends Model<
  InferAttributes<PosTerminal>,
  InferCreationAttributes<PosTerminal>
> {
  declare id: CreationOptional<string>;
  declare location_id: string;
  declare name: string;
  declare code: string;
  declare active: CreationOptional<boolean>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

export function initPosTerminalModel(sequelize: Sequelize): typeof PosTerminal {
  PosTerminal.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      location_id: { type: DataTypes.UUID, allowNull: false },
      name: { type: DataTypes.STRING(150), allowNull: false },
      code: { type: DataTypes.STRING(50), allowNull: false },
      active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      createdAt: { type: DataTypes.DATE, field: "created_at" },
      updatedAt: { type: DataTypes.DATE, field: "updated_at" },
    },
    {
      sequelize,
      tableName: "pos_terminals",
      timestamps: true,
      underscored: true,
      indexes: [
        { fields: ["location_id"] },
        { unique: true, fields: ["location_id", "code"] },
      ],
    },
  );
  return PosTerminal;
}

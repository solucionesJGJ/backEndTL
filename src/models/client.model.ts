import {
  DataTypes,
  Model,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from "sequelize";

export class Client extends Model<
  InferAttributes<Client>,
  InferCreationAttributes<Client>
> {
  declare id: CreationOptional<string>;

  declare name: string;

  declare rut: string | null;
  declare legal_name: string | null;

  /**
   * Snapshot de la actividad económica que TL
   * utilizará por defecto al generar DTE.
   *
   * La relación completa se almacena en
   * client_economic_activities.
   */
  declare business_activity: string | null;

  declare address: string | null;
  declare commune: string | null;
  declare city: string | null;

  declare dte_email: string | null;

  declare contact_name: string | null;
  declare contact_email: string | null;
  declare contact_phone: string | null;

  declare code_prefix: string | null;

  declare active: CreationOptional<boolean>;

  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

export function initClientModel(sequelize: Sequelize): typeof Client {
  Client.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },

      name: {
        type: DataTypes.STRING(150),
        allowNull: false,
      },

      rut: {
        type: DataTypes.STRING(20),
        allowNull: true,
        unique: true,
      },

      legal_name: {
        type: DataTypes.STRING(200),
        allowNull: true,
      },

      business_activity: {
        type: DataTypes.STRING(500),
        allowNull: true,
      },

      address: {
        type: DataTypes.TEXT,
        allowNull: true,
      },

      commune: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },

      city: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },

      dte_email: {
        type: DataTypes.STRING(150),
        allowNull: true,
      },

      contact_name: {
        type: DataTypes.STRING(150),
        allowNull: true,
      },

      contact_email: {
        type: DataTypes.STRING(150),
        allowNull: true,
      },

      contact_phone: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },

      code_prefix: {
        type: DataTypes.STRING(10),
        allowNull: true,
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
      tableName: "clients",
      timestamps: true,
      underscored: true,
    },
  );

  return Client;
}
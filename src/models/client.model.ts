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

  /**
   * Nombre comercial utilizado dentro de TL.
   */
  declare name: string;

  /**
   * Datos tributarios.
   */
  declare rut: string | null;
  declare legal_name: string | null;
  declare business_activity: string | null;

  declare address: string | null;
  declare commune: string | null;
  declare city: string | null;

  /**
   * Correo que eventualmente utilizaremos
   * para envío/intercambio de documentos.
   */
  declare dte_email: string | null;

  /**
   * Datos de contacto operacional.
   */
  declare contact_name: string | null;
  declare contact_email: string | null;
  declare contact_phone: string | null;

  /**
   * Prefijo usado para los códigos
   * de prendas del cliente.
   */
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

      /**
       * Nombre interno/comercial.
       */
      name: {
        type: DataTypes.STRING(150),
        allowNull: false,
      },

      /**
       * RUT tributario.
       */
      rut: {
        type: DataTypes.STRING(20),
        allowNull: true,
        unique: true,
      },

      /**
       * Razón social.
       */
      legal_name: {
        type: DataTypes.STRING(200),
        allowNull: true,
      },

      /**
       * Giro del receptor.
       */
      business_activity: {
        type: DataTypes.STRING(250),
        allowNull: true,
      },

      /**
       * Dirección tributaria/comercial.
       */
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

      /**
       * Correo destinado a documentos
       * tributarios/intercambio.
       */
      dte_email: {
        type: DataTypes.STRING(150),
        allowNull: true,
      },

      /**
       * Contacto operacional.
       */
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

      /**
       * Prefijo para prendas.
       */
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

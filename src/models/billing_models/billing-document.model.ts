import {
  DataTypes,
  Model,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from "sequelize";

export class BillingDocument extends Model<
  InferAttributes<BillingDocument>,
  InferCreationAttributes<BillingDocument>
> {
  declare id: CreationOptional<string>;

  declare client_id: string;
  declare created_by: string;

  /**
   * Estado interno TL.
   */
  declare status: CreationOptional<string>;

  /**
   * Fotografía tributaria del cliente.
   * Estos valores NO deben depender del Client
   * una vez confirmada la facturación.
   */
  declare receiver_rut: string;
  declare receiver_legal_name: string;
  declare receiver_business_activity: string;
  declare receiver_address: string;
  declare receiver_commune: string;
  declare receiver_city: string;
  declare receiver_email: string | null;

  /**
   * Totales comerciales.
   */
  declare subtotal: CreationOptional<number>;
  declare discount_total: CreationOptional<number>;
  declare net_amount: CreationOptional<number>;

  declare tax_rate: CreationOptional<number>;
  declare tax_amount: CreationOptional<number>;

  declare total_amount: CreationOptional<number>;

  declare notes: string | null;

  /**
   * Integración futura con Billing Engine.
   */
  declare engine_document_id: string | null;
  declare engine_status: string | null;
  declare engine_error: string | null;

  declare confirmed_at: Date | null;
  declare sent_to_engine_at: Date | null;

  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

export function initBillingDocumentModel(
  sequelize: Sequelize,
): typeof BillingDocument {
  BillingDocument.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },

      client_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },

      created_by: {
        type: DataTypes.UUID,
        allowNull: false,
      },

      status: {
        type: DataTypes.STRING(30),
        allowNull: false,
        defaultValue: "draft",
      },

      receiver_rut: {
        type: DataTypes.STRING(20),
        allowNull: false,
      },

      receiver_legal_name: {
        type: DataTypes.STRING(200),
        allowNull: false,
      },

      receiver_business_activity: {
        type: DataTypes.STRING(250),
        allowNull: false,
      },

      receiver_address: {
        type: DataTypes.TEXT,
        allowNull: false,
      },

      receiver_commune: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },

      receiver_city: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },

      receiver_email: {
        type: DataTypes.STRING(150),
        allowNull: true,
      },

      subtotal: {
        type: DataTypes.DECIMAL(14, 2),
        allowNull: false,
        defaultValue: 0,
      },

      discount_total: {
        type: DataTypes.DECIMAL(14, 2),
        allowNull: false,
        defaultValue: 0,
      },

      net_amount: {
        type: DataTypes.DECIMAL(14, 2),
        allowNull: false,
        defaultValue: 0,
      },

      tax_rate: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 19,
      },

      tax_amount: {
        type: DataTypes.DECIMAL(14, 2),
        allowNull: false,
        defaultValue: 0,
      },

      total_amount: {
        type: DataTypes.DECIMAL(14, 2),
        allowNull: false,
        defaultValue: 0,
      },

      notes: {
        type: DataTypes.TEXT,
        allowNull: true,
      },

      engine_document_id: {
        type: DataTypes.STRING(150),
        allowNull: true,
      },

      engine_status: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },

      engine_error: {
        type: DataTypes.TEXT,
        allowNull: true,
      },

      confirmed_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },

      sent_to_engine_at: {
        type: DataTypes.DATE,
        allowNull: true,
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
      tableName: "billing_documents",
      timestamps: true,
      underscored: true,

      indexes: [
        {
          fields: ["client_id"],
        },
        {
          fields: ["status"],
        },
        {
          fields: ["engine_document_id"],
        },
      ],
    },
  );

  return BillingDocument;
}

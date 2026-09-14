import {
  DataTypes,
  Model,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from "sequelize";

export class BillingDocumentItem extends Model<
  InferAttributes<BillingDocumentItem>,
  InferCreationAttributes<BillingDocumentItem>
> {
  declare id: CreationOptional<string>;

  declare billing_document_id: string;
  declare batch_id: string;
  declare garment_id: string;

  /**
   * Fotografía histórica de la prenda.
   */
  declare garment_code: string;
  declare garment_description: string;

  /**
   * Cantidad comercial facturable.
   */
  declare quantity: number;

  /**
   * Precio histórico proveniente de
   * GarmentBatchItem.unit_value.
   */
  declare unit_value: number;

  /**
   * Valores antes del descuento.
   */
  declare line_subtotal: number;

  /**
   * Descuento por volumen.
   */
  declare discount_percentage: CreationOptional<number>;
  declare discount_amount: CreationOptional<number>;

  /**
   * Neto final de la línea.
   */
  declare line_total: number;

  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

export function initBillingDocumentItemModel(
  sequelize: Sequelize,
): typeof BillingDocumentItem {
  BillingDocumentItem.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },

      billing_document_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },

      batch_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },

      garment_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },

      garment_code: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },

      garment_description: {
        type: DataTypes.TEXT,
        allowNull: false,
      },

      quantity: {
        type: DataTypes.INTEGER,
        allowNull: false,

        validate: {
          min: 1,
        },
      },

      unit_value: {
        type: DataTypes.DECIMAL(14, 2),
        allowNull: false,

        validate: {
          min: 0,
        },
      },

      line_subtotal: {
        type: DataTypes.DECIMAL(14, 2),
        allowNull: false,

        validate: {
          min: 0,
        },
      },

      discount_percentage: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 0,

        validate: {
          min: 0,
          max: 100,
        },
      },

      discount_amount: {
        type: DataTypes.DECIMAL(14, 2),
        allowNull: false,
        defaultValue: 0,

        validate: {
          min: 0,
        },
      },

      line_total: {
        type: DataTypes.DECIMAL(14, 2),
        allowNull: false,

        validate: {
          min: 0,
        },
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
      tableName: "billing_document_items",

      timestamps: true,
      underscored: true,

      indexes: [
        {
          fields: ["billing_document_id"],
        },

        {
          fields: ["batch_id"],
        },

        {
          fields: ["garment_id"],
        },
      ],
    },
  );

  return BillingDocumentItem;
}

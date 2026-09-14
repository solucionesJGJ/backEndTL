import {
  DataTypes,
  Model,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from "sequelize";

export class BillingDocumentBatch extends Model<
  InferAttributes<BillingDocumentBatch>,
  InferCreationAttributes<BillingDocumentBatch>
> {
  declare id: CreationOptional<string>;

  declare billing_document_id: string;
  declare batch_id: string;

  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

export function initBillingDocumentBatchModel(
  sequelize: Sequelize,
): typeof BillingDocumentBatch {
  BillingDocumentBatch.init(
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
      tableName: "billing_document_batches",

      timestamps: true,
      underscored: true,

      indexes: [
        {
          unique: true,
          fields: ["billing_document_id", "batch_id"],
        },

        {
          fields: ["batch_id"],
        },
      ],
    },
  );

  return BillingDocumentBatch;
}

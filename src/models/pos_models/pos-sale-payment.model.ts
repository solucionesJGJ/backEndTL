import {
  DataTypes,
  Model,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from "sequelize";
export class PosSalePayment extends Model<
  InferAttributes<PosSalePayment>,
  InferCreationAttributes<PosSalePayment>
> {
  declare id: CreationOptional<string>;
  declare sale_id: string;
  declare method: "CASH" | "CARD" | "TRANSFER" | "OTHER";
  declare amount_clp: number;
  declare reference: string | null;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}
export function initPosSalePaymentModel(
  sequelize: Sequelize,
): typeof PosSalePayment {
  PosSalePayment.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      sale_id: { type: DataTypes.UUID, allowNull: false },
      method: {
        type: DataTypes.ENUM("CASH", "CARD", "TRANSFER", "OTHER"),
        allowNull: false,
      },
      amount_clp: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: { min: 1 },
      },
      reference: { type: DataTypes.STRING(150), allowNull: true },
      createdAt: { type: DataTypes.DATE, field: "created_at" },
      updatedAt: { type: DataTypes.DATE, field: "updated_at" },
    },
    {
      sequelize,
      tableName: "pos_sale_payments",
      timestamps: true,
      underscored: true,
      indexes: [{ fields: ["sale_id"] }],
    },
  );
  return PosSalePayment;
}

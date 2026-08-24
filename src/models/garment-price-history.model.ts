import {
    DataTypes,
    Model,
    type Sequelize,
    type CreationOptional,
    type InferAttributes,
    type InferCreationAttributes,
} from "sequelize";

export class GarmentPriceHistory extends Model<
    InferAttributes<GarmentPriceHistory>,
    InferCreationAttributes<GarmentPriceHistory>
> {
    declare id: CreationOptional<string>;

    declare garment_id: string;

    declare old_value: number;
    declare new_value: number;

    declare changed_by: string | null;

    declare createdAt: CreationOptional<Date>;
    declare updatedAt: CreationOptional<Date>;
}

export function initGarmentPriceHistoryModel(
    sequelize: Sequelize
): typeof GarmentPriceHistory {

    GarmentPriceHistory.init(
        {
            id: {
                type: DataTypes.UUID,
                defaultValue: DataTypes.UUIDV4,
                primaryKey: true,
            },

            garment_id: {
                type: DataTypes.UUID,
                allowNull: false,
            },

            old_value: {
                type: DataTypes.DECIMAL(12, 2),
                allowNull: false,
            },

            new_value: {
                type: DataTypes.DECIMAL(12, 2),
                allowNull: false,
            },

            changed_by: {
                type: DataTypes.UUID,
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
            tableName: "garment_price_history",
            timestamps: true,
            underscored: true,

            indexes: [
                {
                    fields: ["garment_id"],
                },
            ],
        }
    );

    return GarmentPriceHistory;
}
import {
    DataTypes,
    Model,
    type Sequelize,
    type CreationOptional,
    type InferAttributes,
    type InferCreationAttributes,
} from "sequelize";

export class GarmentBatchItem extends Model<
    InferAttributes<GarmentBatchItem>,
    InferCreationAttributes<GarmentBatchItem>
> {
    declare id: CreationOptional<string>;
    declare batch_id: string;
    declare garment_id: string;
    declare quantity_sent: CreationOptional<number>;
    declare quantity_received: CreationOptional<number>;
    declare quantity_processed: CreationOptional<number>;
    declare quantity_reprocessed: CreationOptional<number>;
    declare quantity_returned: CreationOptional<number>;
    declare notes: string | null;
    declare createdAt: CreationOptional<Date>;
    declare updatedAt: CreationOptional<Date>;
}

export function initGarmentBatchItemModel(
    sequelize: Sequelize
): typeof GarmentBatchItem {
    GarmentBatchItem.init(
        {
            id: {
                type: DataTypes.UUID,
                defaultValue: DataTypes.UUIDV4,
                primaryKey: true,
            },
            batch_id: {
                type: DataTypes.UUID,
                allowNull: false,
            },
            garment_id: {
                type: DataTypes.UUID,
                allowNull: false,
            },
            quantity_sent: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 0,
                validate: { min: 0 },
            },
            quantity_received: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 0,
                validate: { min: 0 },
            },
            quantity_processed: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 0,
                validate: { min: 0 },
            },
            quantity_reprocessed: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 0,
                validate: { min: 0 },
            },
            quantity_returned: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 0,
                validate: { min: 0 },
            },
            notes: {
                type: DataTypes.TEXT,
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
            tableName: "garment_batch_items",
            timestamps: true,
            underscored: true,
            indexes: [
                {
                    unique: true,
                    fields: ["batch_id", "garment_id"],
                },
            ],
        }
    );

    return GarmentBatchItem;
}
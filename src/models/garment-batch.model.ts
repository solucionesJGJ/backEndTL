import {
    DataTypes,
    Model,
    type Sequelize,
    type CreationOptional,
    type InferAttributes,
    type InferCreationAttributes,
} from "sequelize";

export class GarmentBatch extends Model<
    InferAttributes<GarmentBatch>,
    InferCreationAttributes<GarmentBatch>
> {
    declare id: CreationOptional<string>;
    declare client_id: string;
    declare batch_number: string;
    declare created_by: string;
    declare origin_location: string | null;
    declare destination_location: string | null;
    declare current_status_id: string | null;
    declare received_at: Date | null;
    declare closed_at: Date | null;
    declare notes: string | null;
    declare createdAt: CreationOptional<Date>;
    declare updatedAt: CreationOptional<Date>;
}

export function initGarmentBatchModel(
    sequelize: Sequelize
): typeof GarmentBatch {
    GarmentBatch.init(
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
            batch_number: {
                type: DataTypes.STRING(100),
                allowNull: false,
                unique: true,
            },
            created_by: {
                type: DataTypes.UUID,
                allowNull: false,
            },
            origin_location: {
                type: DataTypes.STRING(150),
                allowNull: true,
            },
            destination_location: {
                type: DataTypes.STRING(150),
                allowNull: true,
            },
            current_status_id: {
                type: DataTypes.UUID,
                allowNull: true,
            },
            received_at: {
                type: DataTypes.DATE,
                allowNull: true,
            },
            closed_at: {
                type: DataTypes.DATE,
                allowNull: true,
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
            tableName: "garment_batches",
            timestamps: true,
            underscored: true,
        }
    );

    return GarmentBatch;
}
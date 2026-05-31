import {
    DataTypes,
    Model,
    type Sequelize,
    type CreationOptional,
    type InferAttributes,
    type InferCreationAttributes,
} from "sequelize";

export class GarmentMovement extends Model<
    InferAttributes<GarmentMovement>,
    InferCreationAttributes<GarmentMovement>
> {
    declare id: CreationOptional<string>;
    declare batch_id: string;
    declare garment_id: string;
    declare from_status_id: string | null;
    declare to_status_id: string;
    declare quantity: number;
    declare movement_type: string;
    declare created_by: string;
    declare notes: string | null;
    declare createdAt: CreationOptional<Date>;
    declare updatedAt: CreationOptional<Date>;
}

export function initGarmentMovementModel(
    sequelize: Sequelize
): typeof GarmentMovement {
    GarmentMovement.init(
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
            from_status_id: {
                type: DataTypes.UUID,
                allowNull: true,
            },
            to_status_id: {
                type: DataTypes.UUID,
                allowNull: false,
            },
            quantity: {
                type: DataTypes.INTEGER,
                allowNull: false,
                validate: { min: 1 },
            },
            movement_type: {
                type: DataTypes.STRING(50),
                allowNull: false,
            },
            created_by: {
                type: DataTypes.UUID,
                allowNull: false,
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
            tableName: "garment_movements",
            timestamps: true,
            underscored: true,
        }
    );

    return GarmentMovement;
}
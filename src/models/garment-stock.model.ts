import {
    DataTypes,
    Model,
    type Sequelize,
    type CreationOptional,
    type InferAttributes,
    type InferCreationAttributes,
} from "sequelize";

export class GarmentStock extends Model<
    InferAttributes<GarmentStock>,
    InferCreationAttributes<GarmentStock>
> {
    declare id: CreationOptional<string>;
    declare client_id: string;
    declare garment_id: string;
    declare status_id: string;
    declare quantity: CreationOptional<number>;
    declare createdAt: CreationOptional<Date>;
    declare updatedAt: CreationOptional<Date>;
}

export function initGarmentStockModel(
    sequelize: Sequelize
): typeof GarmentStock {
    GarmentStock.init(
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
            garment_id: {
                type: DataTypes.UUID,
                allowNull: false,
            },
            status_id: {
                type: DataTypes.UUID,
                allowNull: false,
            },
            quantity: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 0,
                validate: { min: 0 },
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
            tableName: "garment_stock",
            timestamps: true,
            underscored: true,
            indexes: [
                {
                    unique: true,
                    fields: ["client_id", "garment_id", "status_id"],
                },
            ],
        }
    );

    return GarmentStock;
}
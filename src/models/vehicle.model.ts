import {
    DataTypes,
    Model,
    type Sequelize,
    type CreationOptional,
    type InferAttributes,
    type InferCreationAttributes,
} from "sequelize";


export class Vehicle extends Model<
    InferAttributes<Vehicle>,
    InferCreationAttributes<Vehicle>
> {
    declare id: CreationOptional<string>;

    declare plate: string;

    declare brand: string | null;

    declare model: string | null;

    declare year: number | null;

    declare active: CreationOptional<boolean>;

    declare createdAt: CreationOptional<Date>;

    declare updatedAt: CreationOptional<Date>;
}


export function initVehicleModel(
    sequelize: Sequelize,
): typeof Vehicle {

    Vehicle.init(
        {
            id: {
                type: DataTypes.UUID,
                defaultValue: DataTypes.UUIDV4,
                primaryKey: true,
            },

            plate: {
                type: DataTypes.STRING(20),
                allowNull: false,
                unique: true,
            },

            brand: {
                type: DataTypes.STRING(100),
                allowNull: true,
            },

            model: {
                type: DataTypes.STRING(100),
                allowNull: true,
            },

            year: {
                type: DataTypes.INTEGER,
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

            tableName: "vehicles",

            timestamps: true,

            underscored: true,
        }
    );


    return Vehicle;
}
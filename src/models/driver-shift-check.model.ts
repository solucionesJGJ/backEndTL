import {
    DataTypes,
    Model,
    type Sequelize,
    type CreationOptional,
    type InferAttributes,
    type InferCreationAttributes,
} from "sequelize";


export class DriverShiftCheck extends Model<
    InferAttributes<DriverShiftCheck>,
    InferCreationAttributes<DriverShiftCheck>
> {
    declare id: CreationOptional<string>;

    declare shift_id: string;

    declare category: string;

    declare code: string;

    declare label: string;

    declare checked: boolean;

    declare observations: string | null;

    declare createdAt: CreationOptional<Date>;

    declare updatedAt: CreationOptional<Date>;
}


export function initDriverShiftCheckModel(
    sequelize: Sequelize,
): typeof DriverShiftCheck {

    DriverShiftCheck.init(
        {
            id: {
                type: DataTypes.UUID,
                defaultValue: DataTypes.UUIDV4,
                primaryKey: true,
            },

            shift_id: {
                type: DataTypes.UUID,
                allowNull: false,
            },

            category: {
                type: DataTypes.STRING(50),
                allowNull: false,
            },

            code: {
                type: DataTypes.STRING(50),
                allowNull: false,
            },

            label: {
                type: DataTypes.STRING(200),
                allowNull: false,
            },

            checked: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false,
            },

            observations: {
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

            tableName: "driver_shift_checks",

            timestamps: true,

            underscored: true,

            indexes: [
                {
                    fields: [
                        "shift_id",
                    ],
                },

                {
                    unique: true,

                    fields: [
                        "shift_id",
                        "code",
                    ],
                },
            ],
        }
    );


    return DriverShiftCheck;
}
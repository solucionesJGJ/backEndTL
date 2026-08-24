import {
    DataTypes,
    Model,
    type Sequelize,
    type CreationOptional,
    type InferAttributes,
    type InferCreationAttributes,
} from "sequelize";


export class DriverShift extends Model<
    InferAttributes<DriverShift>,
    InferCreationAttributes<DriverShift>
> {
    declare id: CreationOptional<string>;

    declare user_id: string;

    declare vehicle_id: string;

    declare status:
        | "started"
        | "completed"
        | "cancelled";

    declare started_at: Date;

    declare ended_at: Date | null;

    declare initial_mileage: number;

    declare final_mileage: number | null;

    declare start_observations: string | null;

    declare end_observations: string | null;

    declare ticket_number: string;

    declare ticket_pdf_path: string | null;

    declare createdAt: CreationOptional<Date>;

    declare updatedAt: CreationOptional<Date>;
}


export function initDriverShiftModel(
    sequelize: Sequelize,
): typeof DriverShift {

    DriverShift.init(
        {
            id: {
                type: DataTypes.UUID,
                defaultValue: DataTypes.UUIDV4,
                primaryKey: true,
            },

            user_id: {
                type: DataTypes.UUID,
                allowNull: false,
            },

            vehicle_id: {
                type: DataTypes.UUID,
                allowNull: false,
            },

            status: {
                type: DataTypes.STRING(20),
                allowNull: false,
                defaultValue: "started",

                validate: {
                    isIn: [
                        [
                            "started",
                            "completed",
                            "cancelled",
                        ],
                    ],
                },
            },

            started_at: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: DataTypes.NOW,
            },

            ended_at: {
                type: DataTypes.DATE,
                allowNull: true,
            },

            initial_mileage: {
                type: DataTypes.INTEGER,
                allowNull: false,

                validate: {
                    min: 0,
                },
            },

            final_mileage: {
                type: DataTypes.INTEGER,
                allowNull: true,

                validate: {
                    min: 0,
                },
            },

            start_observations: {
                type: DataTypes.TEXT,
                allowNull: true,
            },

            end_observations: {
                type: DataTypes.TEXT,
                allowNull: true,
            },

            ticket_number: {
                type: DataTypes.STRING(50),
                allowNull: false,
                unique: true,
            },

            ticket_pdf_path: {
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

            tableName: "driver_shifts",

            timestamps: true,

            underscored: true,

            indexes: [
                {
                    fields: [
                        "user_id",
                        "status",
                    ],
                },

                {
                    fields: [
                        "vehicle_id",
                        "status",
                    ],
                },

                {
                    fields: [
                        "started_at",
                    ],
                },
            ],
        }
    );


    return DriverShift;
}
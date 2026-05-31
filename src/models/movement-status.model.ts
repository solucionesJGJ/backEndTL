import {
    DataTypes,
    Model,
    type Sequelize,
    type CreationOptional,
    type InferAttributes,
    type InferCreationAttributes,
} from "sequelize";

export class MovementStatus extends Model<
    InferAttributes<MovementStatus>,
    InferCreationAttributes<MovementStatus>
> {
    declare id: CreationOptional<string>;
    declare code: string;
    declare name: string;
    declare sort_order: number;
    declare createdAt: CreationOptional<Date>;
    declare updatedAt: CreationOptional<Date>;
}

export function initMovementStatusModel(
    sequelize: Sequelize
): typeof MovementStatus {
    MovementStatus.init(
        {
            id: {
                type: DataTypes.UUID,
                defaultValue: DataTypes.UUIDV4,
                primaryKey: true,
            },
            code: {
                type: DataTypes.STRING(50),
                allowNull: false,
                unique: true,
            },
            name: {
                type: DataTypes.STRING(100),
                allowNull: false,
            },
            sort_order: {
                type: DataTypes.INTEGER,
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
            tableName: "movement_statuses",
            timestamps: true,
            underscored: true,
        }
    );

    return MovementStatus;
}
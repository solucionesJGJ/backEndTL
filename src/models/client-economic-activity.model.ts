import {
    DataTypes,
    Model,
    type CreationOptional,
    type InferAttributes,
    type InferCreationAttributes,
    type Sequelize,
} from "sequelize";

export class ClientEconomicActivity extends Model<
    InferAttributes<ClientEconomicActivity>,
    InferCreationAttributes<ClientEconomicActivity>
> {
    declare id: CreationOptional<string>;

    declare client_id: string;
    declare economic_activity_id: string;

    declare is_dte_default: CreationOptional<boolean>;

    declare createdAt: CreationOptional<Date>;
    declare updatedAt: CreationOptional<Date>;
}

export function initClientEconomicActivityModel(
    sequelize: Sequelize,
): typeof ClientEconomicActivity {
    ClientEconomicActivity.init(
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

            economic_activity_id: {
                type: DataTypes.UUID,
                allowNull: false,
            },

            is_dte_default: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false,
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
            tableName: "client_economic_activities",
            timestamps: true,
            underscored: true,
            indexes: [
                {
                    unique: true,
                    fields: ["client_id", "economic_activity_id"],
                },
                {
                    fields: ["client_id"],
                },
                {
                    fields: ["economic_activity_id"],
                },
            ],
        },
    );

    return ClientEconomicActivity;
}
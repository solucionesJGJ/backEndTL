import {
    DataTypes,
    Model,
    type CreationOptional,
    type InferAttributes,
    type InferCreationAttributes,
    type Sequelize,
} from "sequelize";

export class EconomicActivity extends Model<
    InferAttributes<EconomicActivity>,
    InferCreationAttributes<EconomicActivity>
> {
    declare id: CreationOptional<string>;

    declare code: string;
    declare description: string;

    declare vat_affected: string | null;
    declare tax_category: string | null;
    declare internet_available: string | null;

    declare active: CreationOptional<boolean>;

    declare createdAt: CreationOptional<Date>;
    declare updatedAt: CreationOptional<Date>;
}

export function initEconomicActivityModel(
    sequelize: Sequelize,
): typeof EconomicActivity {
    EconomicActivity.init(
        {
            id: {
                type: DataTypes.UUID,
                defaultValue: DataTypes.UUIDV4,
                primaryKey: true,
            },

            code: {
                type: DataTypes.STRING(6),
                allowNull: false,
                unique: true,
            },

            description: {
                type: DataTypes.STRING(500),
                allowNull: false,
            },

            vat_affected: {
                type: DataTypes.STRING(10),
                allowNull: true,
            },

            tax_category: {
                type: DataTypes.STRING(10),
                allowNull: true,
            },

            internet_available: {
                type: DataTypes.STRING(10),
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
            tableName: "economic_activities",
            timestamps: true,
            underscored: true,
            indexes: [
                {
                    unique: true,
                    fields: ["code"],
                },
                {
                    fields: ["description"],
                },
            ],
        },
    );

    return EconomicActivity;
}
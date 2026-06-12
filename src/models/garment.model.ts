import {
    DataTypes,
    Model,
    type Sequelize,
    type CreationOptional,
    type InferAttributes,
    type InferCreationAttributes,
} from "sequelize";

export class Garment extends Model<
    InferAttributes<Garment>,
    InferCreationAttributes<Garment>
> {
    declare id: CreationOptional<string>;
    declare garment_type_id: string;
    declare code: string;
    declare description: string | null;
    declare size: string | null;
    declare color: string | null;
    declare barcode: string | null;
    declare active: CreationOptional<boolean>;
    declare createdAt: CreationOptional<Date>;
    declare updatedAt: CreationOptional<Date>;
    declare value: CreationOptional<number>;
}

export function initGarmentModel(sequelize: Sequelize): typeof Garment {
    Garment.init(
        {
            id: {
                type: DataTypes.UUID,
                defaultValue: DataTypes.UUIDV4,
                primaryKey: true,
            },
            garment_type_id: {
                type: DataTypes.UUID,
                allowNull: false,
            },
            code: {
                type: DataTypes.STRING(100),
                allowNull: false,
            },
            description: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
            size: {
                type: DataTypes.STRING(50),
                allowNull: true,
            },
            color: {
                type: DataTypes.STRING(50),
                allowNull: true,
            },
            barcode: {
                type: DataTypes.STRING(100),
                allowNull: true,
                unique: true,
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
            value: {
                type: DataTypes.DECIMAL(12, 2),
                allowNull: false,
                defaultValue: 0,
            }
        },
        {
            sequelize,
            tableName: "garments",
            timestamps: true,
            underscored: true,
            indexes: [
                {
                    unique: true,
                    fields: ["code"],
                },
            ],
        }
    );

    return Garment;
}
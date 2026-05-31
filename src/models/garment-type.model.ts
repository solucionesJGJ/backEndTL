import {
    DataTypes,
    Model,
    type Sequelize,
    type CreationOptional,
    type InferAttributes,
    type InferCreationAttributes,
} from "sequelize";

export class GarmentType extends Model<
    InferAttributes<GarmentType>,
    InferCreationAttributes<GarmentType>
> {
    declare id: CreationOptional<string>;
    declare name: string;
    declare description: string | null;
    declare active: CreationOptional<boolean>;
    declare createdAt: CreationOptional<Date>;
    declare updatedAt: CreationOptional<Date>;
}

export function initGarmentTypeModel(sequelize: Sequelize): typeof GarmentType {
    GarmentType.init(
        {
            id: {
                type: DataTypes.UUID,
                defaultValue: DataTypes.UUIDV4,
                primaryKey: true,
            },
            name: {
                type: DataTypes.STRING(100),
                allowNull: false,
                unique: true,
            },
            description: {
                type: DataTypes.TEXT,
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
            tableName: "garment_types",
            timestamps: true,
            underscored: true,
        }
    );

    return GarmentType;
}
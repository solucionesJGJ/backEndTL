import {
    DataTypes,
    Model,
    type Sequelize,
    type CreationOptional,
    type InferAttributes,
    type InferCreationAttributes,
} from "sequelize";

export class Role extends Model<
    InferAttributes<Role>,
    InferCreationAttributes<Role>
> {
    declare id: CreationOptional<string>;
    declare name: string;
    declare createdAt: CreationOptional<Date>;
    declare updatedAt: CreationOptional<Date>;
}

export function initRoleModel(sequelize: Sequelize): typeof Role {
    Role.init(
        {
            id: {
                type: DataTypes.UUID,
                defaultValue: DataTypes.UUIDV4,
                primaryKey: true,
            },
            name: {
                type: DataTypes.STRING(50),
                allowNull: false,
                unique: true,
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
            tableName: "roles",
            timestamps: true,
            underscored: true,
        }
    );

    return Role;
}
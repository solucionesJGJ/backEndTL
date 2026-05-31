import {
    DataTypes,
    Model,
    type Sequelize,
    type CreationOptional,
    type InferAttributes,
    type InferCreationAttributes,
} from "sequelize";

export class User extends Model<
    InferAttributes<User>,
    InferCreationAttributes<User>
> {
    declare id: CreationOptional<string>;
    declare name: string;
    declare email: string;
    declare password_hash: string;
    declare role_id: string;
    declare client_id: string | null;
    declare active: CreationOptional<boolean>;
    declare createdAt: CreationOptional<Date>;
    declare updatedAt: CreationOptional<Date>;
}

export function initUserModel(sequelize: Sequelize): typeof User {
    User.init(
        {
            id: {
                type: DataTypes.UUID,
                defaultValue: DataTypes.UUIDV4,
                primaryKey: true,
            },
            name: {
                type: DataTypes.STRING(150),
                allowNull: false,
            },
            email: {
                type: DataTypes.STRING(150),
                allowNull: false,
                unique: true,
            },
            password_hash: {
                type: DataTypes.TEXT,
                allowNull: false,
            },
            role_id: {
                type: DataTypes.UUID,
                allowNull: false,
            },
            client_id: {
                type: DataTypes.UUID,
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
            tableName: "users",
            timestamps: true,
            underscored: true,
        }
    );

    return User;
}
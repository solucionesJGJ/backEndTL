import {
    DataTypes,
    Model,
    type Sequelize,
    type CreationOptional,
    type InferAttributes,
    type InferCreationAttributes,
} from "sequelize";

export class Client extends Model<
    InferAttributes<Client>,
    InferCreationAttributes<Client>
> {
    declare id: CreationOptional<string>;
    declare name: string;
    declare rut: string | null;
    declare address: string | null;
    declare contact_name: string | null;
    declare contact_email: string | null;
    declare contact_phone: string | null;
    declare active: CreationOptional<boolean>;
    declare createdAt: CreationOptional<Date>;
    declare updatedAt: CreationOptional<Date>;
}

export function initClientModel(sequelize: Sequelize): typeof Client {
    Client.init(
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
            rut: {
                type: DataTypes.STRING(20),
                allowNull: true,
                unique: true,
            },
            address: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
            contact_name: {
                type: DataTypes.STRING(150),
                allowNull: true,
            },
            contact_email: {
                type: DataTypes.STRING(150),
                allowNull: true,
            },
            contact_phone: {
                type: DataTypes.STRING(50),
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
            tableName: "clients",
            timestamps: true,
            underscored: true,
        }
    );

    return Client;
}
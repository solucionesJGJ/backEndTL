import "dotenv/config";
import { sequelize } from "../models/index.js";

async function syncDatabase() {
    try {
        await sequelize.authenticate();

        await sequelize.sync({
            alter: true,
        });

        console.log("Base de datos sincronizada correctamente");
        process.exit(0);
    } catch (error) {
        console.error("Error al sincronizar base de datos");
        console.error(error);
        process.exit(1);
    }
}

syncDatabase();
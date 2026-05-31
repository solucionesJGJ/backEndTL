import {
    Role,
    MovementStatus,
    sequelize,
} from "../models/index.js";

async function seedDatabase() {
    try {
        await sequelize.authenticate();

        await Role.bulkCreate(
            [
                { name: "admin" },
                { name: "operator" },
                { name: "client" },
            ],
            {
                ignoreDuplicates: true,
            }
        );

        await MovementStatus.bulkCreate(
            [
                {
                    code: "ENTRADA_PLANTA",
                    name: "Entrada planta",
                    sort_order: 1,
                },
                {
                    code: "EN_PROCESO",
                    name: "En proceso",
                    sort_order: 2,
                },
                {
                    code: "REPROCESO",
                    name: "Reproceso",
                    sort_order: 3,
                },
                {
                    code: "TRASLADO_LOCAL",
                    name: "Traslado a local",
                    sort_order: 4,
                },
                {
                    code: "RETORNO_CLIENTE",
                    name: "Retorno cliente",
                    sort_order: 5,
                },
            ],
            {
                ignoreDuplicates: true,
            }
        );

        console.log("Seed inicial ejecutado correctamente");
        process.exit(0);
    } catch (error) {
        console.error("Error ejecutando seed");
        console.error(error);
        process.exit(1);
    }
}

seedDatabase();
import {
    Role,
    MovementStatus,
    sequelize,
    GarmentProcess,
} from "../models/index.js";

async function seedDatabase() {
    try {
        await sequelize.authenticate();

        await GarmentProcess.bulkCreate(
            [
                {
                    name: "Sucio normal",
                    code: "SUCIO_NORMAL",
                    percentage: 0
                },
                {
                    name: "Manchado",
                    code: "MANCHADO",
                    percentage: 30
                },
                {
                    name: "Reproceso",
                    code: "REPROCESO",
                    percentage: 0
                },

            ],
            {
                ignoreDuplicates: true,
            }
        );

        await Role.bulkCreate(
            [
                { name: "client_operator", nameDisplay: "Operador cliente" },
                { name: "warehouse_operator", nameDisplay: "Operador bodega" },
                { name: "admin", nameDisplay: "Administrador" },
                { name: "operator", nameDisplay: "Operador" },
                { name: "client", nameDisplay: "Cliente" },
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
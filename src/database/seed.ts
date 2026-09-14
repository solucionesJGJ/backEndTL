import { MovementStatus, Role, sequelize } from "../models/index.js";

async function seedDatabase() {
  try {
    await sequelize.authenticate();

    /**
     * ROLES
     */
    await Role.bulkCreate(
      [
        {
          name: "client_operator",
          nameDisplay: "Operador cliente",
        },

        {
          name: "warehouse_operator",
          nameDisplay: "Operador bodega",
        },

        {
          name: "transportista",
          nameDisplay: "Transportista",
        },

        {
          name: "admin",
          nameDisplay: "Administrador",
        },
      ],
      {
        ignoreDuplicates: true,
      },
    );

    /**
     * ESTADOS DE MOVIMIENTO
     */
    await MovementStatus.bulkCreate(
      [
        {
          code: "BORRADOR_CLIENTE",
          name: "Borrador cliente",
          sort_order: 0,
        },

        {
          code: "PENDIENTE_RECEPCION",
          name: "Pendiente recepción",
          sort_order: 1,
        },

        {
          code: "RECEPCIONADO",
          name: "Recepcionado",
          sort_order: 2,
        },

        {
          code: "EN_EVALUACION",
          name: "En evaluación",
          sort_order: 3,
        },

        {
          code: "EN_PROCESO",
          name: "En proceso",
          sort_order: 4,
        },

        {
          code: "REPROCESO",
          name: "Reproceso",
          sort_order: 5,
        },

        {
          code: "DERIVADO_EXTERNO",
          name: "Derivado externo",
          sort_order: 6,
        },

        {
          code: "PREPARADO_DESPACHO",
          name: "Preparado para despacho",
          sort_order: 7,
        },

        {
          code: "EN_TRASLADO",
          name: "En traslado",
          sort_order: 8,
        },

        {
          code: "RETORNADO_CLIENTE",
          name: "Retornado al cliente",
          sort_order: 9,
        },

        {
          code: "CERRADO",
          name: "Cerrado",
          sort_order: 10,
        },
        {
          code: "RESUELTO_INCIDENCIA",
          name: "Resuelto con incidencia",
          sort_order: 50,
        },
      ],
      {
        ignoreDuplicates: true,
      },
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

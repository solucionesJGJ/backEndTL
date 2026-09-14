export type DriverChecklistDefinition = {
  category: "vehicle" | "driver";

  code: string;

  label: string;

  required: boolean;
};

export const DRIVER_CHECKLIST: DriverChecklistDefinition[] = [
  {
    category: "vehicle",

    code: "TIRES",

    label: "Neumáticos en condiciones adecuadas",

    required: true,
  },

  {
    category: "vehicle",

    code: "LIGHTS",

    label: "Luces funcionando correctamente",

    required: true,
  },

  {
    category: "vehicle",

    code: "BRAKES",

    label: "Sistema de frenos en condiciones",

    required: true,
  },

  {
    category: "vehicle",

    code: "LEVELS",

    label: "Niveles de aceite y fluidos revisados",

    required: true,
  },

  {
    category: "vehicle",

    code: "VEHICLE_DOCUMENTS",

    label: "Documentación del vehículo disponible",

    required: true,
  },

  {
    category: "vehicle",

    code: "CLEANING",

    label: "Vehículo limpio y en condiciones de uso",

    required: false,
  },

  {
    category: "vehicle",

    code: "VISIBLE_DAMAGE",

    label: "Sin daños visibles relevantes",

    required: false,
  },

  {
    category: "driver",

    code: "LICENSE",

    label: "Licencia de conducir disponible y vigente",

    required: true,
  },

  {
    category: "driver",

    code: "FITNESS",

    label: "Condición física adecuada para conducir",

    required: true,
  },

  {
    category: "driver",

    code: "SAFETY_EQUIPMENT",

    label: "Elementos de seguridad disponibles",

    required: true,
  },

  {
    category: "driver",

    code: "DRIVER_DOCUMENTS",

    label: "Documentación personal requerida disponible",

    required: true,
  },
];

import { MovementStatus } from "../models/index.js";

export async function ensureIncidentResolvedStatus() {
  const [status] = await MovementStatus.findOrCreate({
    where: {
      code: "RESUELTO_INCIDENCIA",
    },
    defaults: {
      code: "RESUELTO_INCIDENCIA",
      name: "Resuelto con incidencia",
      sort_order: 50,
    },
  });

  return status;
}

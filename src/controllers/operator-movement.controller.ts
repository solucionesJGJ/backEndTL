import type { Request, Response } from "express";
import {
  Garment,
  GarmentBatch,
  GarmentIncident,
  GarmentMovement,
  MovementStatus,
  User,
} from "../models/index.js";
import {
  createGarmentIncident,
  type IncidentReason,
} from "../service/garment-incident.service.js";
import { createGarmentMovement } from "../service/garment-movement.service.js";
import { isNonEmptyString, isPositiveInteger } from "../utils/validators.js";

export async function getBatchMovements(req: Request, res: Response) {
  try {
    const batchId = req.params.batchId as string;

    const batch = await GarmentBatch.findByPk(batchId);

    if (!batch) {
      return res.status(404).json({
        ok: false,
        message: "Lote no encontrado",
      });
    }

    const movements = await GarmentMovement.findAll({
      where: {
        batch_id: batchId,
      },
      include: [
        {
          model: Garment,
          as: "garment",
          attributes: ["id", "code", "description"],
        },
        {
          model: MovementStatus,
          as: "from_status",
          attributes: ["id", "code", "name"],
        },
        {
          model: MovementStatus,
          as: "to_status",
          attributes: ["id", "code", "name"],
        },
        {
          model: User,
          as: "creator",
          attributes: ["id", "name", "email"],
        },
        {
          model: GarmentIncident,
          as: "incident",
          required: false,
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    return res.json({
      ok: true,
      data: movements,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      ok: false,
      message: "Error obteniendo movimientos del lote",
    });
  }
}

export async function createBatchMovement(req: Request, res: Response) {
  try {
    const batchId = req.params.batchId as string;

    const {
      garment_id,
      from_status_id,
      to_status_id,
      quantity,
      movement_type,
      notes,
    } = req.body;

    const user = req.user;

    if (!user) {
      return res.status(401).json({
        ok: false,
        message: "Usuario no autenticado",
      });
    }

    const roleName = user?.role?.name;

    if (
      roleName !== "admin" &&
      roleName !== "warehouse_operator" &&
      roleName !== "client_operator"
    ) {
      return res.status(403).json({
        ok: false,
        message: "No tienes permisos para registrar movimientos",
      });
    }

    if (
      !isNonEmptyString(garment_id) ||
      !isNonEmptyString(to_status_id) ||
      quantity === undefined ||
      quantity === null ||
      !isNonEmptyString(movement_type)
    ) {
      return res.status(400).json({
        ok: false,
        message:
          "garment_id, to_status_id, quantity y movement_type son obligatorios",
      });
    }

    if (
      from_status_id !== undefined &&
      from_status_id !== null &&
      from_status_id !== "" &&
      !isNonEmptyString(from_status_id)
    ) {
      return res.status(400).json({
        ok: false,
        message: "from_status_id debe ser un identificador valido",
      });
    }

    if (!isPositiveInteger(quantity)) {
      return res.status(400).json({
        ok: false,
        message: "quantity debe ser un entero mayor a 0",
      });
    }

    /*
     * =====================================================
     * LOTE Y AUTORIZACIÓN POR CLIENTE
     * =====================================================
     */

    const batch = await GarmentBatch.findByPk(batchId);

    if (!batch) {
      return res.status(404).json({
        ok: false,
        message: "Lote no encontrado",
      });
    }

    if (roleName === "client_operator") {
      if (!user.client_id || user.client_id !== batch.client_id) {
        return res.status(403).json({
          ok: false,
          message: "No puedes registrar movimientos en lotes de otro cliente",
        });
      }
    }

    /*
     * =====================================================
     * VALIDAR TRANSICIÓN SEGÚN ROL
     * =====================================================
     *
     * Planta:
     * PENDIENTE_RECEPCION -> EN_PROCESO
     * EN_PROCESO          -> EN_TRASLADO
     *
     * Cliente:
     * EN_TRASLADO         -> CERRADO
     *
     * Admin:
     * puede operar cualquiera de las transiciones
     * funcionales permitidas por el service.
     */

    let fromStatus: MovementStatus | null = null;

    if (isNonEmptyString(from_status_id)) {
      fromStatus = await MovementStatus.findByPk(from_status_id);

      if (!fromStatus) {
        return res.status(400).json({
          ok: false,
          message: "Estado origen no encontrado",
        });
      }
    }

    const toStatus = await MovementStatus.findByPk(to_status_id);

    if (!toStatus) {
      return res.status(400).json({
        ok: false,
        message: "Estado destino no encontrado",
      });
    }

    if (roleName === "warehouse_operator") {
      const allowedPlantTransitions = new Set([
        "PENDIENTE_RECEPCION->EN_PROCESO",
        "EN_PROCESO->EN_TRASLADO",
      ]);

      const transition = `${fromStatus?.code || ""}->${toStatus.code}`;

      if (!allowedPlantTransitions.has(transition)) {
        return res.status(403).json({
          ok: false,
          message:
            "Planta solo puede recepcionar/procesar prendas o enviarlas a traslado",
        });
      }
    }

    if (roleName === "client_operator") {
      if (fromStatus?.code !== "EN_TRASLADO" || toStatus.code !== "CERRADO") {
        return res.status(403).json({
          ok: false,
          message:
            "El cliente solo puede confirmar la recepción de prendas en traslado",
        });
      }

      if (movement_type.trim() !== "recepcion_cliente") {
        return res.status(400).json({
          ok: false,
          message:
            "El movimiento de retorno del cliente debe ser de tipo recepcion_cliente",
        });
      }
    }

    const movement = await createGarmentMovement({
      batch_id: batchId,
      garment_id,
      from_status_id: isNonEmptyString(from_status_id) ? from_status_id : null,
      to_status_id,
      quantity: Number(quantity),
      movement_type: movement_type.trim(),
      created_by: user.id,
      notes: notes || null,
    });

    return res.status(201).json({
      ok: true,
      message: "Movimiento registrado correctamente",
      data: movement,
    });
  } catch (error: any) {
    console.error(error);

    return res.status(400).json({
      ok: false,
      message: error.message || "Error registrando movimiento",
    });
  }
}

const INCIDENT_REASONS = new Set<IncidentReason>([
  "NOT_RECEIVED",
  "MISSING",
  "DAMAGED",
  "DISPATCH_DIFFERENCE",
  "OTHER",
]);

export async function closeBatchGarmentWithIncident(
  req: Request,
  res: Response,
) {
  try {
    const batchId = req.params.batchId as string;
    const { garment_id, origin_status_id, quantity, reason, description } =
      req.body;

    const user = req.user;

    if (!user) {
      return res.status(401).json({
        ok: false,
        message: "Usuario no autenticado",
      });
    }

    const roleName = user?.role?.name;

    if (
      roleName !== "admin" &&
      roleName !== "warehouse_operator" &&
      roleName !== "client_operator"
    ) {
      return res.status(403).json({
        ok: false,
        message: "No tienes permisos para cerrar incidencias",
      });
    }

    if (
      !isNonEmptyString(garment_id) ||
      !isNonEmptyString(origin_status_id) ||
      !isPositiveInteger(quantity) ||
      !isNonEmptyString(reason)
    ) {
      return res.status(400).json({
        ok: false,
        message:
          "garment_id, origin_status_id, quantity y reason son obligatorios",
      });
    }

    if (!INCIDENT_REASONS.has(reason as IncidentReason)) {
      return res.status(400).json({
        ok: false,
        message: "Motivo de incidencia no válido",
      });
    }

    const batch = await GarmentBatch.findByPk(batchId);

    if (!batch) {
      return res.status(404).json({
        ok: false,
        message: "Lote no encontrado",
      });
    }

    if (
      roleName === "client_operator" &&
      (!user.client_id || user.client_id !== batch.client_id)
    ) {
      return res.status(403).json({
        ok: false,
        message: "No puedes cerrar incidencias de lotes de otro cliente",
      });
    }

    const originStatus = await MovementStatus.findByPk(origin_status_id);

    if (!originStatus) {
      return res.status(400).json({
        ok: false,
        message: "Estado origen no encontrado",
      });
    }

    if (
      roleName === "warehouse_operator" &&
      originStatus.code !== "PENDIENTE_RECEPCION"
    ) {
      return res.status(403).json({
        ok: false,
        message: "Planta solo puede cerrar incidencias pendientes de recepción",
      });
    }

    if (roleName === "client_operator" && originStatus.code !== "EN_TRASLADO") {
      return res.status(403).json({
        ok: false,
        message:
          "El cliente solo puede cerrar incidencias de prendas en traslado",
      });
    }

    const result = await createGarmentIncident({
      batch_id: batchId,
      garment_id,
      origin_status_id,
      quantity: Number(quantity),
      reason: reason as IncidentReason,
      description: isNonEmptyString(description) ? description.trim() : null,
      billing_resolution: "PENDING_REVIEW",
      created_by: user.id,
    });

    return res.status(201).json({
      ok: true,
      message: result.batch_resolved
        ? "Incidencia registrada y lote resuelto"
        : "Incidencia registrada correctamente",
      data: result,
    });
  } catch (error: any) {
    console.error(error);

    return res.status(400).json({
      ok: false,
      message: error.message || "Error cerrando la incidencia",
    });
  }
}

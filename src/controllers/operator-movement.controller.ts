import type { Request, Response } from "express";
import {
  Garment,
  GarmentBatch,
  GarmentMovement,
  MovementStatus,
  User,
} from "../models/index.js";
import { createGarmentMovement } from "../service/garment-movement.service.js";

export async function getBatchMovements(req: Request, res: Response) {
  try {
    const { batchId } = req.params;

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
    const { batchId } = req.params;

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

    if (roleName !== "admin" && roleName !== "warehouse_operator") {
      return res.status(403).json({
        ok: false,
        message: "No tienes permisos para registrar movimientos",
      });
    }

    if (!garment_id || !to_status_id || !quantity || !movement_type) {
      return res.status(400).json({
        ok: false,
        message:
          "garment_id, to_status_id, quantity y movement_type son obligatorios",
      });
    }

    const movement = await createGarmentMovement({
      batch_id: batchId,
      garment_id,
      from_status_id: from_status_id || null,
      to_status_id,
      quantity: Number(quantity),
      movement_type,
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
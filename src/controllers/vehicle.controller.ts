import type { Request, Response } from "express";
import { Op } from "sequelize";

import { Vehicle } from "../models/index.js";

import { isNonEmptyString } from "../utils/validators.js";

function normalizePlate(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, "");
}

export async function getVehicles(req: Request, res: Response) {
  try {
    const vehicles = await Vehicle.findAll({
      order: [["plate", "ASC"]],
    });

    return res.json({
      ok: true,
      data: vehicles,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      ok: false,
      message: "Error obteniendo vehículos",
    });
  }
}

export async function getActiveVehicles(req: Request, res: Response) {
  try {
    const vehicles = await Vehicle.findAll({
      where: {
        active: true,
      },

      order: [["plate", "ASC"]],
    });

    return res.json({
      ok: true,
      data: vehicles,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      ok: false,
      message: "Error obteniendo vehículos activos",
    });
  }
}

export async function createVehicle(req: Request, res: Response) {
  try {
    const { plate, brand, model, year } = req.body;

    if (!isNonEmptyString(plate)) {
      return res.status(400).json({
        ok: false,
        message: "La patente es obligatoria",
      });
    }

    const normalizedPlate = normalizePlate(plate);

    const existing = await Vehicle.findOne({
      where: {
        plate: normalizedPlate,
      },
    });

    if (existing) {
      return res.status(409).json({
        ok: false,
        message: "Ya existe un vehículo con esa patente",
      });
    }

    if (
      year !== undefined &&
      year !== null &&
      year !== "" &&
      (!Number.isInteger(Number(year)) || Number(year) < 1900)
    ) {
      return res.status(400).json({
        ok: false,
        message: "El año del vehículo no es válido",
      });
    }

    const vehicle = await Vehicle.create({
      plate: normalizedPlate,

      brand: isNonEmptyString(brand) ? brand.trim() : null,

      model: isNonEmptyString(model) ? model.trim() : null,

      year:
        year !== undefined && year !== null && year !== ""
          ? Number(year)
          : null,

      active: true,
    });

    return res.status(201).json({
      ok: true,
      message: "Vehículo creado correctamente",
      data: vehicle,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      ok: false,
      message: "Error creando vehículo",
    });
  }
}

export async function updateVehicle(req: Request, res: Response) {
  try {
    const id = req.params.id as string;

    const { plate, brand, model, year, active } = req.body;

    const vehicle = await Vehicle.findByPk(id);

    if (!vehicle) {
      return res.status(404).json({
        ok: false,
        message: "Vehículo no encontrado",
      });
    }

    if (!isNonEmptyString(plate)) {
      return res.status(400).json({
        ok: false,
        message: "La patente es obligatoria",
      });
    }

    const normalizedPlate = normalizePlate(plate);

    const existing = await Vehicle.findOne({
      where: {
        plate: normalizedPlate,

        id: {
          [Op.ne]: id,
        },
      },
    });

    if (existing) {
      return res.status(409).json({
        ok: false,
        message: "Ya existe otro vehículo con esa patente",
      });
    }

    if (
      year !== undefined &&
      year !== null &&
      year !== "" &&
      (!Number.isInteger(Number(year)) || Number(year) < 1900)
    ) {
      return res.status(400).json({
        ok: false,
        message: "El año del vehículo no es válido",
      });
    }

    await vehicle.update({
      plate: normalizedPlate,

      brand: isNonEmptyString(brand) ? brand.trim() : null,

      model: isNonEmptyString(model) ? model.trim() : null,

      year:
        year !== undefined && year !== null && year !== ""
          ? Number(year)
          : null,

      active: typeof active === "boolean" ? active : vehicle.active,
    });

    return res.json({
      ok: true,
      message: "Vehículo actualizado correctamente",
      data: vehicle,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      ok: false,
      message: "Error actualizando vehículo",
    });
  }
}

export async function deactivateVehicle(req: Request, res: Response) {
  try {
    const id = req.params.id as string;

    const vehicle = await Vehicle.findByPk(id);

    if (!vehicle) {
      return res.status(404).json({
        ok: false,
        message: "Vehículo no encontrado",
      });
    }

    await vehicle.update({
      active: false,
    });

    return res.json({
      ok: true,
      message: "Vehículo desactivado correctamente",
      data: vehicle,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      ok: false,
      message: "Error desactivando vehículo",
    });
  }
}

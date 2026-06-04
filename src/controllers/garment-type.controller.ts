import { Op } from "sequelize";
import type { Request, Response } from "express";
import { GarmentType } from "../models/index.js";

export async function getGarmentTypes(req: Request, res: Response) {
    try {
        const garmentTypes = await GarmentType.findAll({
            order: [["createdAt", "DESC"]],
        });

        return res.json({
            ok: true,
            data: garmentTypes,
        });
    } catch (error) {
        console.error(error);

        return res.status(500).json({
            ok: false,
            message: "Error obteniendo tipos de prenda",
        });
    }
}

export async function getGarmentTypeById(req: Request, res: Response) {
    try {
        const { id } = req.params;

        const garmentType = await GarmentType.findByPk(id);

        if (!garmentType) {
            return res.status(404).json({
                ok: false,
                message: "Tipo de prenda no encontrado",
            });
        }

        return res.json({
            ok: true,
            data: garmentType,
        });
    } catch (error) {
        console.error(error);

        return res.status(500).json({
            ok: false,
            message: "Error obteniendo tipo de prenda",
        });
    }
}

export async function createGarmentType(req: Request, res: Response) {
    try {
        const { name, description } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({
                ok: false,
                message: "El nombre del tipo de prenda es obligatorio",
            });
        }

        const existingGarmentType = await GarmentType.findOne({
            where: {
                name: name.trim(),
            },
        });

        if (existingGarmentType) {
            return res.status(409).json({
                ok: false,
                message: "Ya existe un tipo de prenda con ese nombre",
            });
        }

        const garmentType = await GarmentType.create({
            name: name.trim(),
            description: description || null,
            active: true,
        });

        return res.status(201).json({
            ok: true,
            message: "Tipo de prenda creado correctamente",
            data: garmentType,
        });
    } catch (error) {
        console.error(error);

        return res.status(500).json({
            ok: false,
            message: "Error creando tipo de prenda",
        });
    }
}

export async function updateGarmentType(req: Request, res: Response) {
    try {
        const { id } = req.params;
        const { name, description, active } = req.body;

        const garmentType = await GarmentType.findByPk(id);

        if (!garmentType) {
            return res.status(404).json({
                ok: false,
                message: "Tipo de prenda no encontrado",
            });
        }

        if (!name || !name.trim()) {
            return res.status(400).json({
                ok: false,
                message: "El nombre del tipo de prenda es obligatorio",
            });
        }

        const existingGarmentType = await GarmentType.findOne({
            where: {
                name: name.trim(),
                id: {
                    [Op.ne]: id,
                },
            },
        });

        if (existingGarmentType) {
            return res.status(409).json({
                ok: false,
                message: "Ya existe otro tipo de prenda con ese nombre",
            });
        }

        await garmentType.update({
            name: name.trim(),
            description: description || null,
            active: typeof active === "boolean" ? active : garmentType.active,
        });

        return res.json({
            ok: true,
            message: "Tipo de prenda actualizado correctamente",
            data: garmentType,
        });
    } catch (error) {
        console.error(error);

        return res.status(500).json({
            ok: false,
            message: "Error actualizando tipo de prenda",
        });
    }
}

export async function deleteGarmentType(req: Request, res: Response) {
    try {
        const { id } = req.params;

        const garmentType = await GarmentType.findByPk(id);

        if (!garmentType) {
            return res.status(404).json({
                ok: false,
                message: "Tipo de prenda no encontrado",
            });
        }

        await garmentType.destroy();

        return res.json({
            ok: true,
            message: "Tipo de prenda eliminado correctamente",
        });
    } catch (error) {
        console.error(error);

        return res.status(500).json({
            ok: false,
            message: "Error eliminando tipo de prenda",
        });
    }
}

export async function deactivateGarmentType(req: Request, res: Response) {
    try {
        const { id } = req.params;

        const garmentType = await GarmentType.findByPk(id);

        if (!garmentType) {
            return res.status(404).json({
                ok: false,
                message: "Tipo de prenda no encontrado",
            });
        }

        await garmentType.update({
            active: false,
        });

        return res.json({
            ok: true,
            message: "Tipo de prenda desactivado correctamente",
            data: garmentType,
        });
    } catch (error) {
        console.error(error);

        return res.status(500).json({
            ok: false,
            message: "Error desactivando tipo de prenda",
        });
    }
}
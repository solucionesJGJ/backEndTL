import { Op } from "sequelize";
import type { Request, Response } from "express";
import { GarmentProcess } from "../models/index.js";

export async function getGarmentProcesses(req: Request, res: Response) {
    try {
        const processes = await GarmentProcess.findAll({
            order: [["createdAt", "DESC"]],
        });

        return res.json({
            ok: true,
            data: processes,
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            ok: false,
            message: "Error obteniendo procesos",
        });
    }
}

export async function createGarmentProcess(req: Request, res: Response) {
    try {
        const { name, code, percentage } = req.body;

        if (!name?.trim() || !code?.trim()) {
            return res.status(400).json({
                ok: false,
                message: "name y code son obligatorios",
            });
        }

        const existing = await GarmentProcess.findOne({
            where: {
                [Op.or]: [{ name: name.trim() }, { code: code.trim().toUpperCase() }],
            },
        });

        if (existing) {
            return res.status(409).json({
                ok: false,
                message: "Ya existe un proceso con ese nombre o código",
            });
        }

        const process = await GarmentProcess.create({
            name: name.trim(),
            code: code.trim().toUpperCase(),
            percentage: Number(percentage || 0),
            active: true,
        });

        return res.status(201).json({
            ok: true,
            message: "Proceso creado correctamente",
            data: process,
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            ok: false,
            message: "Error creando proceso",
        });
    }
}

export async function updateGarmentProcess(req: Request, res: Response) {
    try {
        const { id } = req.params;
        const { name, code, percentage, active } = req.body;

        const process = await GarmentProcess.findByPk(id);

        if (!process) {
            return res.status(404).json({
                ok: false,
                message: "Proceso no encontrado",
            });
        }

        if (!name?.trim() || !code?.trim()) {
            return res.status(400).json({
                ok: false,
                message: "name y code son obligatorios",
            });
        }

        const existing = await GarmentProcess.findOne({
            where: {
                id: { [Op.ne]: id },
                [Op.or]: [{ name: name.trim() }, { code: code.trim().toUpperCase() }],
            },
        });

        if (existing) {
            return res.status(409).json({
                ok: false,
                message: "Ya existe otro proceso con ese nombre o código",
            });
        }

        await process.update({
            name: name.trim(),
            code: code.trim().toUpperCase(),
            percentage: Number(percentage || 0),
            active: typeof active === "boolean" ? active : process.active,
        });

        return res.json({
            ok: true,
            message: "Proceso actualizado correctamente",
            data: process,
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            ok: false,
            message: "Error actualizando proceso",
        });
    }
}

export async function deactivateGarmentProcess(req: Request, res: Response) {
    try {
        const { id } = req.params;

        const process = await GarmentProcess.findByPk(id);

        if (!process) {
            return res.status(404).json({
                ok: false,
                message: "Proceso no encontrado",
            });
        }

        await process.update({ active: false });

        return res.json({
            ok: true,
            message: "Proceso desactivado correctamente",
            data: process,
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            ok: false,
            message: "Error desactivando proceso",
        });
    }
}
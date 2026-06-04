import type { Request, Response } from "express";
import { Role } from "../models/index.js";

export async function getRoles(req: Request, res: Response) {
    try {
        const roles = await Role.findAll({
            order: [["name", "ASC"]],
        });

        return res.json({
            ok: true,
            data: roles,
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            ok: false,
            message: "Error obteniendo roles",
        });
    }
}
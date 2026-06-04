import type { Request, Response } from "express";
import { Client } from "../models/index.js";
import { Op } from "sequelize";

export async function createClient(req: Request, res: Response) {
    try {
        const {
            name,
            rut,
            address,
            contact_name,
            contact_email,
            contact_phone,
        } = req.body;

        if (!name) {
            return res.status(400).json({
                ok: false,
                message: "El nombre del cliente es obligatorio",
            });
        }

        const existingClient = await Client.findOne({
            where: { rut },
        });

        if (rut && existingClient) {
            return res.status(409).json({
                ok: false,
                message: "Ya existe un cliente con ese RUT",
            });
        }

        const client = await Client.create({
            name,
            rut,
            address,
            contact_name,
            contact_email,
            contact_phone,
            active: true,
        });

        return res.status(201).json({
            ok: true,
            message: "Cliente creado correctamente",
            data: client,
        });
    } catch (error) {
        console.error(error);

        return res.status(500).json({
            ok: false,
            message: "Error creando cliente",
        });
    }
}

export async function getClients(req: Request, res: Response) {
    try {
        const clients = await Client.findAll({
            order: [["createdAt", "DESC"]],
        });

        return res.json({
            ok: true,
            data: clients,
        });
    } catch (error) {
        console.error(error);

        return res.status(500).json({
            ok: false,
            message: "Error obteniendo clientes",
        });
    }
}

export async function getClientById(req: Request, res: Response) {
    try {
        const { id } = req.params;

        const client = await Client.findByPk(id);

        if (!client) {
            return res.status(404).json({
                ok: false,
                message: "Cliente no encontrado",
            });
        }

        return res.json({
            ok: true,
            data: client,
        });
    } catch (error) {
        console.error(error);

        return res.status(500).json({
            ok: false,
            message: "Error obteniendo cliente",
        });
    }
}

export async function updateClient(req: Request, res: Response) {
    try {
        const { id } = req.params;

        const {
            name,
            rut,
            address,
            contact_name,
            contact_email,
            contact_phone,
            active,
        } = req.body;

        const client = await Client.findByPk(id);

        if (!client) {
            return res.status(404).json({
                ok: false,
                message: "Cliente no encontrado",
            });
        }

        if (!name || !name.trim()) {
            return res.status(400).json({
                ok: false,
                message: "El nombre del cliente es obligatorio",
            });
        }

        if (rut) {
            const existingClient = await Client.findOne({
                where: {
                    rut,
                    id: {
                        [Op.ne]: id,
                    },
                },
            });

            if (existingClient) {
                return res.status(409).json({
                    ok: false,
                    message: "Ya existe otro cliente con ese RUT",
                });
            }
        }

        await client.update({
            name,
            rut: rut || null,
            address: address || null,
            contact_name: contact_name || null,
            contact_email: contact_email || null,
            contact_phone: contact_phone || null,
            active: typeof active === "boolean" ? active : client.active,
        });

        return res.json({
            ok: true,
            message: "Cliente actualizado correctamente",
            data: client,
        });
    } catch (error) {
        console.error(error);

        return res.status(500).json({
            ok: false,
            message: "Error actualizando cliente",
        });
    }
}
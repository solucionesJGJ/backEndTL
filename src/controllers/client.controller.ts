import type { Request, Response } from "express";
import { Client } from "../models/index.js";
import { Op } from "sequelize";
import {
    formatRut,
    isNonEmptyString,
    isValidEmail,
    isValidPhoneCL,
    isValidRut,
    normalizeText,
} from "../utils/validators.js";

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

        if (!isNonEmptyString(name) || !isNonEmptyString(rut) || !isNonEmptyString(contact_name) || !isNonEmptyString(contact_email) || !isNonEmptyString(contact_phone)) {
            return res.status(400).json({
                ok: false,
                message: "Todos los campos son obligatorios",
            });
        }

        if (!isValidRut(rut)) {
            return res.status(400).json({
                ok: false,
                message: "El RUT ingresado no es valido",
            });
        }

        if (!isValidEmail(contact_email)) {
            return res.status(400).json({
                ok: false,
                message: "El email de contacto no es valido",
            });
        }

        if (!isValidPhoneCL(contact_phone)) {
            return res.status(400).json({
                ok: false,
                message: "El telefono debe tener formato chileno valido",
            });
        }

        const normalizedRut = formatRut(rut);
        const normalizedEmail = contact_email.trim().toLowerCase();

        const existingClient = await Client.findOne({
            where: { rut: normalizedRut },
        });

        if (existingClient) {
            return res.status(409).json({
                ok: false,
                message: "Ya existe un cliente con ese RUT",
            });
        }

        const client = await Client.create({
            name: normalizeText(name),
            rut: normalizedRut,
            address: address ? normalizeText(address) : null,
            contact_name: normalizeText(contact_name),
            contact_email: normalizedEmail,
            contact_phone: contact_phone.trim(),
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
        const id = req.params.id as string;

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
        const id = req.params.id as string;

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

        if (!isNonEmptyString(name) || !isNonEmptyString(rut) || !isNonEmptyString(contact_name) || !isNonEmptyString(contact_email) || !isNonEmptyString(contact_phone)) {
            return res.status(400).json({
                ok: false,
                message: "Todos los campos son obligatorios",
            });
        }

        if (!isValidRut(rut)) {
            return res.status(400).json({
                ok: false,
                message: "El RUT ingresado no es valido",
            });
        }

        if (!isValidEmail(contact_email)) {
            return res.status(400).json({
                ok: false,
                message: "El email de contacto no es valido",
            });
        }

        if (!isValidPhoneCL(contact_phone)) {
            return res.status(400).json({
                ok: false,
                message: "El telefono debe tener formato chileno valido",
            });
        }

        const normalizedRut = formatRut(rut);

        const existingClient = await Client.findOne({
            where: {
                rut: normalizedRut,
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

        await client.update({
            name: normalizeText(name),
            rut: normalizedRut,
            address: address ? normalizeText(address) : null,
            contact_name: normalizeText(contact_name),
            contact_email: contact_email.trim().toLowerCase(),
            contact_phone: contact_phone.trim(),
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

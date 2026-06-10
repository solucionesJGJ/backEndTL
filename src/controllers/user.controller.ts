import bcrypt from "bcrypt";
import { Op } from "sequelize";
import type { Request, Response } from "express";
import { Client, Role, User } from "../models/index.js";
import { isValidEmail } from "../utils/validators.js";

export async function getUsers(req: Request, res: Response) {
    try {
        const users = await User.findAll({
            attributes: { exclude: ["password_hash"] },
            include: [
                { model: Role, as: "role", attributes: ["id", "name", "name_display"] },
                { model: Client, as: "client", attributes: ["id", "name", "rut"] },
            ],
            order: [["createdAt", "DESC"]],
        });

        return res.json({ ok: true, data: users });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ ok: false, message: "Error obteniendo usuarios" });
    }
}

export async function createUser(req: Request, res: Response) {
    try {
        const { name, email, password, role_id, client_id } = req.body;
        if (!isValidEmail(email)) {
            return res.status(400).json({
                ok: false,
                message: 'El email no es válido',
            })
        }

        if (password && password.length < 8) {
            return res.status(400).json({
                ok: false,
                message: 'La contraseña debe tener al menos 8 caracteres',
            })
        }

        if (!name || !email || !password || !role_id) {
            return res.status(400).json({
                ok: false,
                message: "name, email, password y role_id son obligatorios",
            });
        }

        const existingUser = await User.findOne({ where: { email } });

        if (existingUser) {
            return res.status(409).json({
                ok: false,
                message: "Ya existe un usuario con ese email",
            });
        }

        const role = await Role.findByPk(role_id);

        if (!role) {
            return res.status(404).json({
                ok: false,
                message: "Rol no encontrado",
            });
        }

        if (role.name === "client" && !client_id) {
            return res.status(400).json({
                ok: false,
                message: "Los usuarios cliente deben tener un cliente asociado",
            });
        }

        if (client_id) {
            const client = await Client.findByPk(client_id);

            if (!client) {
                return res.status(404).json({
                    ok: false,
                    message: "Cliente no encontrado",
                });
            }
        }

        const passwordHash = await bcrypt.hash(password, 10);

        const user = await User.create({
            name,
            email,
            password_hash: passwordHash,
            role_id,
            client_id: client_id || null,
            active: true,
        });

        return res.status(201).json({
            ok: true,
            message: "Usuario creado correctamente",
            data: {
                id: user.id,
                name: user.name,
                email: user.email,
                role_id: user.role_id,
                client_id: user.client_id,
                active: user.active,
            },
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ ok: false, message: "Error creando usuario" });
    }
}

export async function updateUser(req: Request, res: Response) {
    try {
        const { id } = req.params;
        const { name, email, password, role_id, client_id, active } = req.body;

        const user = await User.findByPk(id);

        if (!user) {
            return res.status(404).json({
                ok: false,
                message: "Usuario no encontrado",
            });
        }

        if (!name || !email || !role_id) {
            return res.status(400).json({
                ok: false,
                message: "name, email y role_id son obligatorios",
            });
        }

        const existingEmail = await User.findOne({
            where: {
                email,
                id: { [Op.ne]: id },
            },
        });

        if (existingEmail) {
            return res.status(409).json({
                ok: false,
                message: "Ya existe otro usuario con ese email",
            });
        }

        const role = await Role.findByPk(role_id);

        if (!role) {
            return res.status(404).json({
                ok: false,
                message: "Rol no encontrado",
            });
        }

        if (role.name === "client" && !client_id) {
            return res.status(400).json({
                ok: false,
                message: "Los usuarios cliente deben tener un cliente asociado",
            });
        }

        if (client_id) {
            const client = await Client.findByPk(client_id);

            if (!client) {
                return res.status(404).json({
                    ok: false,
                    message: "Cliente no encontrado",
                });
            }
        }

        const updatePayload: any = {
            name,
            email,
            role_id,
            client_id: role.name === "client" ? client_id : null,
            active: typeof active === "boolean" ? active : user.active,
        };

        if (password && password.trim()) {
            updatePayload.password_hash = await bcrypt.hash(password, 10);
        }

        await user.update(updatePayload);

        return res.json({
            ok: true,
            message: "Usuario actualizado correctamente",
            data: {
                id: user.id,
                name: user.name,
                email: user.email,
                role_id: user.role_id,
                client_id: user.client_id,
                active: user.active,
            },
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ ok: false, message: "Error actualizando usuario" });
    }
}

export async function deactivateUser(req: Request, res: Response) {
    try {
        const { id } = req.params;

        const user = await User.findByPk(id);

        if (!user) {
            return res.status(404).json({
                ok: false,
                message: "Usuario no encontrado",
            });
        }

        await user.update({ active: false });

        return res.json({
            ok: true,
            message: "Usuario desactivado correctamente",
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ ok: false, message: "Error desactivando usuario" });
    }
}
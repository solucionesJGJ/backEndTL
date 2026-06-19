import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import type { Request, Response } from "express";
import { Role, User, Client } from "../models/index.js";
import { isValidEmail, normalizeText } from "../utils/validators.js";

function buildToken(user: User, roleName?: string) {
    const tokenPayload = {
        id: user.id,
        email: user.email,
        role_id: user.role_id,
        role_name: roleName,
        client_id: user.client_id,
    };

    return jwt.sign(
        tokenPayload,
        process.env.JWT_SECRET as jwt.Secret,
        {
            expiresIn: process.env.JWT_EXPIRES_IN || "8h",
        } as jwt.SignOptions
    );
}

export async function bootstrapAdmin(req: Request, res: Response) {
    try {
        const { name, email, password } = req.body;

        if (!process.env.JWT_SECRET) {
            return res.status(500).json({
                ok: false,
                message: "JWT_SECRET no estÃ¡ configurado",
            });
        }

        const userCount = await User.count();

        if (userCount > 0) {
            return res.status(409).json({
                ok: false,
                message: "El usuario administrador inicial ya fue creado",
            });
        }

        if (!name?.trim() || !email?.trim() || !password) {
            return res.status(400).json({
                ok: false,
                message: "name, email y password son obligatorios",
            });
        }

        if (!isValidEmail(email)) {
            return res.status(400).json({
                ok: false,
                message: "El email no es vÃ¡lido",
            });
        }

        if (password.length < 8) {
            return res.status(400).json({
                ok: false,
                message: "La contraseÃ±a debe tener al menos 8 caracteres",
            });
        }

        const [adminRole] = await Role.findOrCreate({
            where: { name: "admin" },
            defaults: {
                name: "admin",
                nameDisplay: "Administrador",
            },
        });

        const passwordHash = await bcrypt.hash(password, 10);

        const user = await User.create({
            name: normalizeText(name),
            email: email.trim().toLowerCase(),
            password_hash: passwordHash,
            role_id: adminRole.id,
            client_id: null,
            active: true,
        });

        const token = buildToken(user, adminRole.name);

        return res.status(201).json({
            ok: true,
            message: "Administrador inicial creado correctamente",
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: {
                    id: adminRole.id,
                    name: adminRole.name,
                    nameDisplay: adminRole.nameDisplay,
                },
                client: null,
            },
        });
    } catch (error) {
        console.error(error);

        return res.status(500).json({
            ok: false,
            message: "Error creando administrador inicial",
        });
    }
}

export async function login(req: Request, res: Response) {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                ok: false,
                message: "email y password son obligatorios",
            });
        }

        const user = await User.findOne({
            where: {
                email: email.trim().toLowerCase(),
                active: true,
            },
            include: [
                {
                    model: Role,
                    as: "role",
                    attributes: ["id", "name", "name_display"],
                },
                {
                    model: Client,
                    as: "client",
                    attributes: ["id", "name", "rut"],
                },
            ],
        });

        if (!user) {
            return res.status(401).json({
                ok: false,
                message: "Credenciales inválidas",
            });
        }

        const passwordIsValid = await bcrypt.compare(
            password,
            user.password_hash
        );

        if (!passwordIsValid) {
            return res.status(401).json({
                ok: false,
                message: "Credenciales inválidas",
            });
        }

        const userJson = user.toJSON() as any;

        const token = buildToken(user, userJson.role?.name);

        return res.json({
            ok: true,
            message: "Login correcto",
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: userJson.role,
                client: userJson.client,
            },
        });
    } catch (error) {
        console.error(error);

        return res.status(500).json({
            ok: false,
            message: "Error iniciando sesión",
        });
    }
}

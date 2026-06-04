import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import type { Request, Response } from "express";
import { Role, User, Client } from "../models/index.js";

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
                email,
                active: true,
            },
            include: [
                {
                    model: Role,
                    as: "role",
                    attributes: ["id", "name"],
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

        const tokenPayload = {
            id: user.id,
            email: user.email,
            role_id: user.role_id,
            role_name: userJson.role?.name,
            client_id: user.client_id,
        };

        const token = jwt.sign(
            tokenPayload,
            process.env.JWT_SECRET as jwt.Secret,
            {
                expiresIn: process.env.JWT_EXPIRES_IN || "8h",
            } as jwt.SignOptions
        );

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
import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";
import { Role, User, Client } from "../models/index.js";

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        ok: false,
        message: "Token no enviado",
      });
    }

    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET as string
    ) as {
      id: string;
      email: string;
      role_id: string;
      role_name: string;
      client_id: string | null;
    };

    const user = await User.findOne({
      where: {
        id: decoded.id,
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
        message: "Usuario no válido o inactivo",
      });
    }

    req.user = user.toJSON() as any;

    next();
  } catch (error) {
    return res.status(401).json({
      ok: false,
      message: "Token inválido o expirado",
    });
  }
}
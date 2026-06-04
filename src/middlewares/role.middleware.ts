// src/middlewares/role.middleware.ts
import type { Request, Response, NextFunction } from "express";

export function requireRole(...allowedRoles: string[]) {
    return (req: Request, res: Response, next: NextFunction) => {
        const user = req.user as any;

        if (!user) {
            return res.status(401).json({
                ok: false,
                message: "Usuario no autenticado",
            });
        }

        if (!allowedRoles.includes(user.role?.name)) {
            return res.status(403).json({
                ok: false,
                message: "No tienes permisos para realizar esta acción",
            });
        }

        next();
    };
}
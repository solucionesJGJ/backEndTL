import type { Request } from "express";

export function getLoggedUser(req: Request) {
    return req.user;
}

export function isAdmin(req: Request) {
    return req.user?.role?.name === "admin";
}

export function isClientOperator(req: Request) {
    return req.user?.role?.name === "client_operator";
}

export function isWarehouseOperator(req: Request) {
    return req.user?.role?.name === "warehouse_operator";
}
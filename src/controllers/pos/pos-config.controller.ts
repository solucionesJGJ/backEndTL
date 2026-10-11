import type { Request, Response } from "express";
import {
  PosConfigError, listOrganizations, getOrganization, createOrganization, updateOrganization,
  listLocations, getLocation, createLocation, updateLocation,
} from "../../services/pos/pos-config.service.js";

type Handler = (req: Request) => Promise<unknown>;
function handle(fn: Handler, success = 200) {
  return async (req: Request, res: Response) => {
    try { const data = await fn(req); return res.status(success).json({ ok: true, data }); }
    catch (e) {
      if (e instanceof PosConfigError) return res.status(e.status).json({ ok: false, message: e.message });
      console.error("POS config error:", e);
      return res.status(500).json({ ok: false, message: "Error interno de configuración POS" });
    }
  };
}
const body = (req: Request): Record<string, unknown> => req.body && typeof req.body === "object" && !Array.isArray(req.body) ? req.body as Record<string, unknown> : {};
const id = (req: Request): string => String(req.params.id);
export const getOrganizations = handle(() => listOrganizations());
export const getOrganizationById = handle(req => getOrganization(id(req)));
export const postOrganization = handle(req => createOrganization(body(req)), 201);
export const putOrganization = handle(req => updateOrganization(id(req), body(req)));
export const getLocations = handle(req => listLocations(typeof req.query.organization_id === "string" ? req.query.organization_id : undefined));
export const getLocationById = handle(req => getLocation(id(req)));
export const postLocation = handle(req => createLocation(body(req)), 201);
export const putLocation = handle(req => updateLocation(id(req), body(req)));

import type { Request, Response } from "express";
import {
  createTaxProfile, createTerminal, getTaxProfile, getTerminal,
  listTaxProfiles, listTerminals, updateTaxProfile, updateTerminal, handlePosError,
} from "../../services/pos/pos-resources.service.js";

type Handler = (req: Request) => Promise<unknown>;
function respond(handler:Handler,status=200) {
  return async (req:Request,res:Response) => {
    try { return res.status(status).json({ok:true,data:await handler(req)}); }
    catch(error) { const e=handlePosError(error); return res.status(e.status).json({ok:false,message:e.message}); }
  };
}
export const getTaxProfiles = respond(req=>listTaxProfiles(req.query.organization_id));
export const getTaxProfileById = respond(req=>getTaxProfile(req.params.id as string));
export const postTaxProfile = respond(req=>createTaxProfile(req.body),201);
export const putTaxProfile = respond(req=>updateTaxProfile(req.params.id as string,req.body));
export const getTerminals = respond(req=>listTerminals(req.query.location_id,req.query.organization_id));
export const getTerminalById = respond(req=>getTerminal(req.params.id as string));
export const postTerminal = respond(req=>createTerminal(req.body),201);
export const putTerminal = respond(req=>updateTerminal(req.params.id as string,req.body));

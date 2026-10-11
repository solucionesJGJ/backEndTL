import type {Request,Response} from "express";
import {listLocationPrices,getEffectivePrice,upsertLocationPrice,updateLocationPrice,handleLocationPriceError} from "../../services/pos/pos-location-price.service.js";
type Handler=(req:Request)=>Promise<unknown>;
const respond=(handler:Handler)=>async(req:Request,res:Response)=>{try{return res.status(200).json({ok:true,data:await handler(req)});}catch(error){const e=handleLocationPriceError(error);return res.status(e.status).json({ok:false,message:e.message});}};
export const getLocationPrices=respond(req=>listLocationPrices(req.params.locationId));
export const getEffectiveItemPrice=respond(req=>getEffectivePrice(req.params.locationId,req.params.itemId));
export const putLocationPrice=respond(req=>upsertLocationPrice(req.body));
export const patchLocationPrice=respond(req=>updateLocationPrice(req.params.id,req.body));

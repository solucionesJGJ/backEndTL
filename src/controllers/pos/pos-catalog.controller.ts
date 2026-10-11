import type { Request,Response } from "express";
import { listCategories,getCategory,createCategory,updateCategory,listItems,getItem,createItem,updateItem,handleCatalogError } from "../../services/pos/pos-catalog.service.js";
type Handler=(req:Request)=>Promise<unknown>;
function respond(fn:Handler,status=200){return async(req:Request,res:Response)=>{try{return res.status(status).json({ok:true,data:await fn(req)});}catch(e){const err=handleCatalogError(e);return res.status(err.status).json({ok:false,message:err.message});}};}
export const getCategories=respond(req=>listCategories(req.query.organization_id));
export const getCategoryById=respond(req=>getCategory(req.params.id));
export const postCategory=respond(req=>createCategory(req.body),201);
export const putCategory=respond(req=>updateCategory(req.params.id,req.body));
export const getItems=respond(req=>listItems(req.query.organization_id,req.query.category_id));
export const getItemById=respond(req=>getItem(req.params.id));
export const postItem=respond(req=>createItem(req.body),201);
export const putItem=respond(req=>updateItem(req.params.id,req.body));

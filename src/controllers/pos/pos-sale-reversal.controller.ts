import type { Request, Response } from "express";
import { createSaleReversal, getSaleReversal, listSaleReversals, handleReversalError } from "../../services/pos/pos-sale-reversal.service.js";

export async function postSaleReversal(req: Request, res: Response) {
  try {
    const actor = req.user as { id?: string } | undefined;
    const result = await createSaleReversal(req.params.id, req.body, actor?.id);
    return res.status(result.replayed ? 200 : 201).json({ ok: true, replayed: result.replayed, data: result.reversal });
  } catch (error) { const e = handleReversalError(error); return res.status(e.status).json({ ok: false, message: e.message }); }
}
export async function getSaleReversalBySale(req: Request, res: Response) {
  try { return res.json({ ok: true, data: await getSaleReversal(req.params.id) }); }
  catch (error) { const e = handleReversalError(error); return res.status(e.status).json({ ok: false, message: e.message }); }
}
export async function getSaleReversals(req: Request, res: Response) {
  try { return res.json({ ok: true, data: await listSaleReversals(req.query) }); }
  catch (error) { const e = handleReversalError(error); return res.status(e.status).json({ ok: false, message: e.message }); }
}

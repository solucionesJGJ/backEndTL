import type { Request, Response } from "express";
import {
  createSale,
  getSale,
  listSales,
  handleSaleError,
} from "../../services/pos/pos-sale.service.js";
export async function postSale(req: Request, res: Response) {
  try {
    const user = req.user as { id?: string } | undefined;
    const result = await createSale(req.body, user?.id);
    return res
      .status(result.replayed ? 200 : 201)
      .json({ ok: true, replayed: result.replayed, data: result.sale });
  } catch (error) {
    const e = handleSaleError(error);
    return res.status(e.status).json({ ok: false, message: e.message });
  }
}
export async function getSaleById(req: Request, res: Response) {
  try {
    return res.json({ ok: true, data: await getSale(req.params.id) });
  } catch (error) {
    const e = handleSaleError(error);
    return res.status(e.status).json({ ok: false, message: e.message });
  }
}
export async function getSales(req: Request, res: Response) {
  try {
    return res.json({ ok: true, data: await listSales(req.query) });
  } catch (error) {
    const e = handleSaleError(error);
    return res.status(e.status).json({ ok: false, message: e.message });
  }
}

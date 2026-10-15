import type { Request, Response } from "express";
import { openCash, addCashMovement, closeCash, cashSummary, getCashSession, listCashSessions, listCashMovements, handleCashError } from "../../services/pos/pos-cash.service.js";
const actor = (req: Request) => (req.user as { id?: string } | undefined)?.id;
const fail = (res: Response, error: unknown) => { const e = handleCashError(error); return res.status(e.status).json({ ok: false, message: e.message }); };
export async function postCashOpen(req: Request, res: Response) { try { return res.status(201).json({ ok: true, data: await openCash(req.body, actor(req)) }); } catch (e) { return fail(res, e); } }
export async function postCashMovement(req: Request, res: Response) { try { const r = await addCashMovement(req.params.id, req.body, actor(req)); return res.status(r.replayed ? 200 : 201).json({ ok: true, replayed: r.replayed, data: r.movement }); } catch (e) { return fail(res, e); } }
export async function postCashClose(req: Request, res: Response) { try { return res.json({ ok: true, data: await closeCash(req.params.id, req.body, actor(req)) }); } catch (e) { return fail(res, e); } }
export async function getCashSummary(req: Request, res: Response) { try { return res.json({ ok: true, data: await cashSummary(req.params.id) }); } catch (e) { return fail(res, e); } }
export async function getCashById(req: Request, res: Response) { try { return res.json({ ok: true, data: await getCashSession(req.params.id) }); } catch (e) { return fail(res, e); } }
export async function getCashSessions(req: Request, res: Response) { try { return res.json({ ok: true, data: await listCashSessions(req.query) }); } catch (e) { return fail(res, e); } }
export async function getCashMovements(req: Request, res: Response) { try { return res.json({ ok: true, data: await listCashMovements(req.params.id) }); } catch (e) { return fail(res, e); } }

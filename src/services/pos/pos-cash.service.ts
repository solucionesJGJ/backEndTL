import { UniqueConstraintError, type Transaction } from "sequelize";
import { sequelize, PosCashSession, PosCashMovement, PosSale, PosSalePayment, PosTerminal, PosLocation, PosOrganization, User } from "../../models/index.js";

class CashError extends Error { constructor(public status: number, message: string) { super(message); } }
const uuid = (v: unknown, n: string): string => {
  if (typeof v !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)) throw new CashError(400, `${n} debe ser UUID válido`);
  return v;
};
const body = (v: unknown): Record<string, unknown> => {
  if (!v || typeof v !== "object" || Array.isArray(v)) throw new CashError(400, "Body JSON inválido");
  return v as Record<string, unknown>;
};
const clp = (v: unknown, n: string, min = 0): number => {
  if (typeof v !== "number" || !Number.isSafeInteger(v) || v < min || v > 2147483647) throw new CashError(400, `${n} debe ser entero entre ${min} y 2147483647`);
  return v;
};
const note = (v: unknown, n: string, required = false): string | null => {
  if (v == null && !required) return null;
  if (typeof v !== "string" || v.trim().length > 500 || (required && !v.trim())) throw new CashError(400, `${n} inválida (máximo 500 caracteres)`);
  return v.trim() || null;
};
const checked = (v: number): number => {
  if (!Number.isSafeInteger(v) || Math.abs(v) > 2147483647) throw new CashError(409, "El saldo excede el rango de pesos CLP admitido");
  return v;
};
async function activeActor(id: string, t: Transaction) {
  const user = await User.findByPk(id, { transaction: t });
  if (!user?.active) throw new CashError(403, "Usuario inactivo o inexistente");
}
async function lockSession(id: string, t: Transaction) {
  const session = await PosCashSession.findByPk(id, { transaction: t, lock: t.LOCK.UPDATE });
  if (!session) throw new CashError(404, "Sesión de caja no encontrada");
  return session;
}
export async function openCash(raw: unknown, actorRaw: unknown) {
  const b = body(raw), actor = uuid(actorRaw, "usuario"), terminalId = uuid(b.terminal_id, "terminal_id");
  const opening = clp(b.opening_cash_clp, "opening_cash_clp"), openingNote = note(b.opening_note, "opening_note");
  try {
    return await sequelize.transaction(async t => {
      await activeActor(actor, t);
      // Bloqueo del terminal: serializa aperturas concurrentes incluso antes de crear una sesión.
      const terminal = await PosTerminal.findByPk(terminalId, { transaction: t, lock: t.LOCK.UPDATE });
      if (!terminal) throw new CashError(404, "Terminal no encontrado");
      const location = await PosLocation.findByPk(terminal.location_id, { transaction: t });
      if (!location) throw new CashError(404, "Local no encontrado");
      const org = await PosOrganization.findByPk(location.organization_id, { transaction: t });
      if (!terminal.active || !location.active || !org?.active) throw new CashError(409, "Organización, local o terminal inactivo");
      const prior = await PosCashSession.findOne({ where: { terminal_id: terminalId, status: "OPEN" }, transaction: t });
      if (prior) throw new CashError(409, "La terminal ya tiene una caja abierta");
      return PosCashSession.create({ organization_id: org.id, location_id: location.id, terminal_id: terminalId, opened_by: actor, closed_by: null, opening_cash_clp: opening, expected_cash_clp: null, counted_cash_clp: null, difference_clp: null, opening_note: openingNote, closing_note: null, closed_at: null }, { transaction: t });
    });
  } catch (e) {
    if (e instanceof UniqueConstraintError) throw new CashError(409, "La terminal ya tiene una caja abierta");
    throw e;
  }
}
export async function addCashMovement(sessionRaw: unknown, raw: unknown, actorRaw: unknown) {
  const sessionId = uuid(sessionRaw, "session_id"), actor = uuid(actorRaw, "usuario"), b = body(raw);
  const requestId = uuid(b.request_id, "request_id");
  if (b.type !== "CASH_IN" && b.type !== "CASH_OUT") throw new CashError(400, "type debe ser CASH_IN o CASH_OUT");
  const type: "CASH_IN" | "CASH_OUT" = b.type;
  const amount = clp(b.amount_clp, "amount_clp", 1), reason = note(b.reason, "reason", true)!;
  const replay = (m: PosCashMovement) => {
    if (m.session_id !== sessionId || m.type !== type || m.amount_clp !== amount || m.reason !== reason || m.created_by !== actor) throw new CashError(409, "request_id ya utilizado con otros datos");
    return { movement: m, replayed: true };
  };
  const old = await PosCashMovement.findOne({ where: { request_id: requestId } });
  if (old) return replay(old);
  try {
    return await sequelize.transaction(async t => {
      const session = await lockSession(sessionId, t);
      if (session.status !== "OPEN") throw new CashError(409, "La caja está cerrada");
      await activeActor(actor, t);
      const existing = await PosCashMovement.findOne({ where: { request_id: requestId }, transaction: t });
      if (existing) return replay(existing);
      const movement = await PosCashMovement.create({ session_id: sessionId, request_id: requestId, created_by: actor, type, amount_clp: amount, reason }, { transaction: t });
      return { movement, replayed: false };
    });
  } catch (e) {
    if (e instanceof UniqueConstraintError) {
      const found = await PosCashMovement.findOne({ where: { request_id: requestId } });
      if (found) return replay(found);
    }
    throw e;
  }
}
async function summary(session: PosCashSession, t?: Transaction) {
  const opts = t ? { transaction: t } : {};
  const sales = await PosSale.findAll({ where: { cash_session_id: session.id }, include: [{ model: PosSalePayment, as: "payments" }], ...opts });
  let cashSales = 0, otherSales = 0, salesCount = 0;
  for (const sale of sales) {
    salesCount++;
    const pays = (sale as PosSale & { payments?: PosSalePayment[] }).payments ?? [];
    for (const p of pays) {
      if (p.method === "CASH") cashSales = checked(cashSales + p.amount_clp);
      else otherSales = checked(otherSales + p.amount_clp);
    }
    cashSales = checked(cashSales - sale.change_clp);
  }
  const movements = await PosCashMovement.findAll({ where: { session_id: session.id }, ...opts });
  let cashIn = 0, cashOut = 0;
  for (const m of movements) {
    if (m.type === "CASH_IN") cashIn = checked(cashIn + m.amount_clp);
    else cashOut = checked(cashOut + m.amount_clp);
  }
  const expected = checked(session.opening_cash_clp + cashSales + cashIn - cashOut);
  return { session_id: session.id, status: session.status, opening_cash_clp: session.opening_cash_clp, sales_count: salesCount, cash_sales_net_clp: cashSales, non_cash_payments_clp: otherSales, cash_in_clp: cashIn, cash_out_clp: cashOut, expected_cash_clp: expected, counted_cash_clp: session.counted_cash_clp, difference_clp: session.difference_clp, note: "Devoluciones REFUND no se restan automáticamente: registrar CASH_OUT una sola vez cuando corresponda." };
}
export async function cashSummary(idRaw: unknown) {
  const id = uuid(idRaw, "session_id");
  return sequelize.transaction(async t => {
    const session = await lockSession(id, t);
    return summary(session, t);
  });
}
export async function closeCash(idRaw: unknown, raw: unknown, actorRaw: unknown) {
  const id = uuid(idRaw, "session_id"), actor = uuid(actorRaw, "usuario"), b = body(raw);
  const counted = clp(b.counted_cash_clp, "counted_cash_clp"), closingNote = note(b.closing_note, "closing_note");
  return sequelize.transaction(async t => {
    const session = await lockSession(id, t);
    if (session.status !== "OPEN") throw new CashError(409, "La caja ya está cerrada");
    await activeActor(actor, t);
    const totals = await summary(session, t);
    const difference = checked(counted - totals.expected_cash_clp);
    await session.update({ status: "CLOSED", closed_by: actor, closed_at: new Date(), expected_cash_clp: totals.expected_cash_clp, counted_cash_clp: counted, difference_clp: difference, closing_note: closingNote }, { transaction: t });
    return { session, summary: { ...totals, status: "CLOSED", counted_cash_clp: counted, difference_clp: difference } };
  });
}
export async function getCashSession(idRaw: unknown) {
  const session = await PosCashSession.findByPk(uuid(idRaw, "session_id"));
  if (!session) throw new CashError(404, "Sesión de caja no encontrada");
  return session;
}
export async function listCashSessions(filters: { terminal_id?: unknown; location_id?: unknown; status?: unknown; limit?: unknown }) {
  const where: { terminal_id?: string; location_id?: string; status?: "OPEN" | "CLOSED" } = {};
  if (filters.terminal_id !== undefined) where.terminal_id = uuid(filters.terminal_id, "terminal_id");
  if (filters.location_id !== undefined) where.location_id = uuid(filters.location_id, "location_id");
  if (filters.status !== undefined) {
    if (filters.status !== "OPEN" && filters.status !== "CLOSED") throw new CashError(400, "status inválido");
    where.status = filters.status;
  }
  const limit = filters.limit === undefined ? 50 : Number(filters.limit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new CashError(400, "limit debe estar entre 1 y 100");
  return PosCashSession.findAll({ where, order: [["opened_at", "DESC"]], limit });
}
export async function listCashMovements(idRaw: unknown) {
  const id = uuid(idRaw, "session_id");
  await getCashSession(id);
  return PosCashMovement.findAll({ where: { session_id: id }, order: [["createdAt", "ASC"]] });
}
export function handleCashError(e: unknown) {
  if (e instanceof CashError) return { status: e.status, message: e.message };
  if (e instanceof UniqueConstraintError) return { status: 409, message: "Conflicto de integridad de caja" };
  console.error("POS cash error", e);
  return { status: 500, message: "Error interno de caja POS" };
}

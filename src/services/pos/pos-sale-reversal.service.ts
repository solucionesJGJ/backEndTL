import { UniqueConstraintError } from "sequelize";
import { sequelize, PosSale, PosSaleReversal, User } from "../../models/index.js";

class ReversalError extends Error { constructor(public status: number, message: string) { super(message); } }
const uuid = (v: unknown, name: string): string => {
  if (typeof v !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)) throw new ReversalError(400, `${name} debe ser UUID válido`);
  return v;
};
const body = (v: unknown): Record<string, unknown> => {
  if (!v || typeof v !== "object" || Array.isArray(v)) throw new ReversalError(400, "Body JSON inválido");
  return v as Record<string, unknown>;
};
const method = (v: unknown): "CASH" | "CARD" | "TRANSFER" | "OTHER" => {
  if (v !== "CASH" && v !== "CARD" && v !== "TRANSFER" && v !== "OTHER") throw new ReversalError(400, "refund_method inválido");
  return v;
};
const checkReplay = (r: PosSaleReversal, saleId: string, type: "VOID" | "REFUND") => {
  if (r.sale_id !== saleId || r.type !== type) throw new ReversalError(409, "request_id ya utilizado en otra operación");
  return { reversal: r, replayed: true };
};

export async function createSaleReversal(saleIdRaw: unknown, raw: unknown, actorRaw: unknown) {
  const saleId = uuid(saleIdRaw, "sale_id");
  const actorId = uuid(actorRaw, "usuario");
  const b = body(raw);
  const requestId = uuid(b.request_id, "request_id");
  const type: "VOID" | "REFUND" = b.type === "VOID" || b.type === "REFUND" ? b.type : (() => { throw new ReversalError(400, "type debe ser VOID o REFUND"); })();
  if (typeof b.reason !== "string" || !b.reason.trim() || b.reason.trim().length > 500) throw new ReversalError(400, "reason obligatorio (máximo 500 caracteres)");
  const reason = b.reason.trim();
  // VOID es reversa administrativa sin flujo de dinero; REFUND registra una devolución total.
  if (type === "VOID" && (b.refund_method !== undefined || b.refund_reference !== undefined)) throw new ReversalError(400, "VOID no acepta datos de devolución");
  const refundMethod = type === "REFUND" ? method(b.refund_method) : null;
  const refundReference = type === "REFUND" && b.refund_reference != null
    ? (typeof b.refund_reference === "string" && b.refund_reference.trim().length <= 150 ? b.refund_reference.trim() || null : (() => { throw new ReversalError(400, "refund_reference inválida"); })())
    : null;
  const existing = await PosSaleReversal.findOne({ where: { request_id: requestId } });
  if (existing) return checkReplay(existing, saleId, type);
  try {
    return await sequelize.transaction(async transaction => {
      // Bloqueo por venta: impide dos reversas simultáneas sobre una misma venta.
      const sale = await PosSale.findByPk(saleId, { transaction, lock: transaction.LOCK.UPDATE });
      if (!sale) throw new ReversalError(404, "Venta no encontrada");
      if (sale.status !== "PAID") throw new ReversalError(409, "La venta no está pagada");
      const actor = await User.findByPk(actorId, { transaction });
      if (!actor?.active) throw new ReversalError(403, "Usuario inactivo o inexistente");
      const prior = await PosSaleReversal.findOne({ where: { sale_id: saleId }, transaction });
      if (prior) {
        if (prior.request_id === requestId) return checkReplay(prior, saleId, type);
        throw new ReversalError(409, "La venta ya tiene una anulación o devolución registrada");
      }
      const reversal = await PosSaleReversal.create({
        sale_id: saleId, request_id: requestId, type, reason,
        amount_clp: sale.total_clp, refund_method: refundMethod,
        refund_reference: refundReference, created_by: actorId,
      }, { transaction });
      return { reversal, replayed: false };
    });
  } catch (error) {
    if (error instanceof UniqueConstraintError) {
      const retry = await PosSaleReversal.findOne({ where: { request_id: requestId } });
      if (retry) return checkReplay(retry, saleId, type);
      throw new ReversalError(409, "La venta ya tiene una reversa registrada");
    }
    throw error;
  }
}

export async function getSaleReversal(saleIdRaw: unknown) {
  const saleId = uuid(saleIdRaw, "sale_id");
  const sale = await PosSale.findByPk(saleId);
  if (!sale) throw new ReversalError(404, "Venta no encontrada");
  return PosSaleReversal.findOne({ where: { sale_id: saleId } });
}

export async function listSaleReversals(filters: { organization_id?: unknown; location_id?: unknown; limit?: unknown }) {
  const where: Record<string, string> = {};
  if (filters.organization_id !== undefined) where.organization_id = uuid(filters.organization_id, "organization_id");
  if (filters.location_id !== undefined) where.location_id = uuid(filters.location_id, "location_id");
  const limit = filters.limit === undefined ? 50 : Number(filters.limit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new ReversalError(400, "limit debe estar entre 1 y 100");
  return PosSaleReversal.findAll({ include: [{ model: PosSale, as: "sale", required: true, where }], order: [["createdAt", "DESC"]], limit });
}

export function handleReversalError(error: unknown) {
  if (error instanceof ReversalError) return { status: error.status, message: error.message };
  if (error instanceof UniqueConstraintError) return { status: 409, message: "Conflicto de reversa" };
  console.error("POS reversal error", error);
  return { status: 500, message: "Error interno de reversas POS" };
}

import { Op, UniqueConstraintError, type Transaction } from "sequelize";
import {
  sequelize,
  PosOrganization,
  PosLocation,
  PosTerminal,
  PosItem,
  PosLocationPrice,
  PosSale,
  PosSaleItem,
  PosSalePayment,
  User,
} from "../../models/index.js";
class SaleError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
const uuid = (v: unknown, n: string): string => {
  if (
    typeof v !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      v,
    )
  )
    throw new SaleError(400, `${n} debe ser UUID válido`);
  return v;
};
const object = (v: unknown): Record<string, unknown> => {
  if (!v || typeof v !== "object" || Array.isArray(v))
    throw new SaleError(400, "Se requiere un objeto JSON");
  return v as Record<string, unknown>;
};
const amount = (v: unknown, n: string, min = 0): number => {
  if (
    typeof v !== "number" ||
    !Number.isSafeInteger(v) ||
    v < min ||
    v > 2147483647
  )
    throw new SaleError(400, `${n} debe ser entero entre ${min} y 2147483647`);
  return v;
};
const add = (a: number, b: number): number => {
  const x = a + b;
  if (!Number.isSafeInteger(x) || x > 2147483647)
    throw new SaleError(400, "El total excede el límite admitido");
  return x;
};
const details = {
  include: [
    { model: PosSaleItem, as: "items" },
    { model: PosSalePayment, as: "payments" },
  ],
};
export async function createSale(raw: unknown, actorId: unknown) {
  const b = object(raw),
    created_by = uuid(actorId, "usuario"),
    request_id = uuid(b.request_id, "request_id"),
    location_id = uuid(b.location_id, "location_id"),
    terminal_id = uuid(b.terminal_id, "terminal_id");
  const rows = b.items,
    pays = b.payments;
  if (!Array.isArray(rows) || rows.length < 1 || rows.length > 100)
    throw new SaleError(400, "items debe tener entre 1 y 100 elementos");
  if (!Array.isArray(pays) || pays.length < 1 || pays.length > 10)
    throw new SaleError(400, "payments debe tener entre 1 y 10 elementos");
  // Una solicitud repetida jamás debe crear otra venta, incluso si llegó simultáneamente.
  const existing = await PosSale.findOne({ where: { request_id }, ...details });
  if (existing) return { sale: existing, replayed: true };
  try {
    return await sequelize.transaction(async (t: Transaction) => {
      const duplicate = await PosSale.findOne({
        where: { request_id },
        transaction: t,
        ...details,
      });
      if (duplicate) return { sale: duplicate, replayed: true };
      const location = await PosLocation.findByPk(location_id, {
        transaction: t,
      });
      if (!location) throw new SaleError(404, "Local no encontrado");
      const organization = await PosOrganization.findByPk(
        location.organization_id,
        { transaction: t },
      );
      if (!organization?.active || !location.active)
        throw new SaleError(409, "Organización o local inactivo");
      const terminal = await PosTerminal.findByPk(terminal_id, {
        transaction: t,
      });
      if (!terminal || terminal.location_id !== location_id)
        throw new SaleError(400, "Terminal no pertenece al local");
      if (!terminal.active) throw new SaleError(409, "Terminal inactivo");
      const user = await User.findByPk(created_by, { transaction: t });
      if (!user?.active)
        throw new SaleError(403, "Usuario inactivo o inexistente");
      const seen = new Set<string>();
      let total = 0;
      const items = [] as {
        item_id: string;
        item_code: string;
        item_name: string;
        item_type: "PRODUCT" | "SERVICE";
        quantity: number;
        unit_price_clp: number;
        line_total_clp: number;
      }[];
      for (const entry of rows) {
        const r = object(entry),
          item_id = uuid(r.item_id, "item_id"),
          quantity = amount(r.quantity, "quantity", 1);
        if (seen.has(item_id))
          throw new SaleError(
            400,
            "No se permite repetir item_id; agrupa cantidades",
          );
        seen.add(item_id);
        const item = await PosItem.findByPk(item_id, { transaction: t });
        if (!item) throw new SaleError(404, "Artículo no encontrado");
        if (item.organization_id !== organization.id)
          throw new SaleError(400, "Artículo de otra organización");
        if (!item.active) throw new SaleError(409, "Artículo inactivo");
        const override = await PosLocationPrice.findOne({
          where: { location_id, item_id, active: true },
          transaction: t,
        });
        const unit_price_clp = amount(
          override?.price_clp ?? item.price_clp,
          "precio",
        );
        const line_total_clp = amount(
          unit_price_clp * quantity,
          "line_total_clp",
        );
        total = add(total, line_total_clp);
        items.push({
          item_id,
          item_code: item.code,
          item_name: item.name,
          item_type: item.item_type,
          quantity,
          unit_price_clp,
          line_total_clp,
        });
      }
      if (total === 0)
        throw new SaleError(400, "No se permiten ventas de total cero");
      let paid = 0,
        cash = 0;
      const payments = [] as {
        method: "CASH" | "CARD" | "TRANSFER" | "OTHER";
        amount_clp: number;
        reference: string | null;
      }[];
      for (const entry of pays) {
        const r = object(entry);
        if (
          r.method !== "CASH" &&
          r.method !== "CARD" &&
          r.method !== "TRANSFER" &&
          r.method !== "OTHER"
        )
          throw new SaleError(400, "Método de pago inválido");
        const value = amount(r.amount_clp, "amount_clp", 1);
        paid = add(paid, value);
        if (r.method === "CASH") cash = add(cash, value);
        const reference =
          r.reference === undefined || r.reference === null
            ? null
            : typeof r.reference === "string" &&
                r.reference.trim().length <= 150
              ? r.reference.trim()
              : null;
        if (r.reference != null && reference === null)
          throw new SaleError(400, "reference inválida");
        payments.push({ method: r.method, amount_clp: value, reference });
      }
      if (paid < total) throw new SaleError(400, "El pago es insuficiente");
      if (paid - total > cash)
        throw new SaleError(400, "El vuelto solo puede provenir de efectivo");
      const sale = await PosSale.create(
        {
          organization_id: organization.id,
          location_id,
          terminal_id,
          created_by,
          request_id,
          subtotal_clp: total,
          total_clp: total,
          paid_clp: paid,
          change_clp: paid - total,
        },
        { transaction: t },
      );
      await PosSaleItem.bulkCreate(
        items.map((i) => ({ ...i, sale_id: sale.id })),
        { transaction: t },
      );
      await PosSalePayment.bulkCreate(
        payments.map((p) => ({ ...p, sale_id: sale.id })),
        { transaction: t },
      );
      const complete = await PosSale.findByPk(sale.id, {
        transaction: t,
        ...details,
      });
      return { sale: complete, replayed: false };
    });
  } catch (error) {
    if (error instanceof UniqueConstraintError) {
      const found = await PosSale.findOne({
        where: { request_id },
        ...details,
      });
      if (found) return { sale: found, replayed: true };
    }
    throw error;
  }
}
export async function getSale(id: unknown) {
  const sale = await PosSale.findByPk(uuid(id, "id"), details);
  if (!sale) throw new SaleError(404, "Venta no encontrada");
  return sale;
}
export async function listSales(filters: {
  organization_id?: unknown;
  location_id?: unknown;
  terminal_id?: unknown;
  limit?: unknown;
}) {
  const where: {
    organization_id?: string;
    location_id?: string;
    terminal_id?: string;
  } = {};
  if (filters.organization_id !== undefined)
    where.organization_id = uuid(filters.organization_id, "organization_id");
  if (filters.location_id !== undefined)
    where.location_id = uuid(filters.location_id, "location_id");
  if (filters.terminal_id !== undefined)
    where.terminal_id = uuid(filters.terminal_id, "terminal_id");
  const limit = filters.limit === undefined ? 50 : Number(filters.limit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100)
    throw new SaleError(400, "limit debe estar entre 1 y 100");
  return PosSale.findAll({
    where,
    order: [["createdAt", "DESC"]],
    limit,
    ...details,
  });
}
export function handleSaleError(error: unknown) {
  if (error instanceof SaleError)
    return { status: error.status, message: error.message };
  if (error instanceof UniqueConstraintError)
    return { status: 409, message: "Conflicto de registro" };
  console.error("POS sale error", error);
  return { status: 500, message: "Error interno de ventas POS" };
}

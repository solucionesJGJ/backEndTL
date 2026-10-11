import { UniqueConstraintError } from "sequelize";
import {
  PosLocation,
  PosItem,
  PosLocationPrice,
  PosOrganization,
} from "../../models/index.js";
class PriceError extends Error {
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
    throw new PriceError(400, `${n} debe ser UUID válido`);
  return v;
};
const body = (v: unknown): Record<string, unknown> => {
  if (!v || typeof v !== "object" || Array.isArray(v))
    throw new PriceError(400, "Body JSON inválido");
  return v as Record<string, unknown>;
};
const price = (v: unknown): number => {
  if (
    typeof v !== "number" ||
    !Number.isSafeInteger(v) ||
    v < 0 ||
    v > 2147483647
  )
    throw new PriceError(400, "price_clp debe ser entero entre 0 y 2147483647");
  return v;
};
const bool = (v: unknown): boolean => {
  if (typeof v !== "boolean")
    throw new PriceError(400, "active debe ser booleano");
  return v;
};
async function location(id: string) {
  const x = await PosLocation.findByPk(id);
  if (!x) throw new PriceError(404, "Local no encontrado");
  return x;
}
async function item(id: string) {
  const x = await PosItem.findByPk(id);
  if (!x) throw new PriceError(404, "Artículo no encontrado");
  return x;
}
async function validatePair(lid: string, iid: string, requireActive = false) {
  const loc = await location(lid),
    it = await item(iid);
  if (loc.organization_id !== it.organization_id)
    throw new PriceError(400, "Artículo de otra organización");
  if (requireActive) {
    const org = await PosOrganization.findByPk(loc.organization_id);
    if (!org?.active || !loc.active || !it.active)
      throw new PriceError(409, "Organización, local o artículo inactivo");
  }
  return it;
}
export async function listLocationPrices(locationId: unknown) {
  const id = uuid(locationId, "location_id");
  await location(id);
  return PosLocationPrice.findAll({
    where: { location_id: id },
    include: [
      {
        model: PosItem,
        as: "item",
        attributes: ["id", "name", "code", "item_type", "price_clp", "active"],
      },
    ],
    order: [["createdAt", "ASC"]],
  });
}
export async function getEffectivePrice(locationId: unknown, itemId: unknown) {
  const lid = uuid(locationId, "location_id"),
    iid = uuid(itemId, "item_id");
  const it = await validatePair(lid, iid);
  const override = await PosLocationPrice.findOne({
    where: { location_id: lid, item_id: iid, active: true },
  });
  return {
    location_id: lid,
    item_id: iid,
    price_clp: override?.price_clp ?? it.price_clp,
    source: override ? "LOCATION" : "BASE",
  };
}
export async function upsertLocationPrice(raw: unknown) {
  const b = body(raw),
    lid = uuid(b.location_id, "location_id"),
    iid = uuid(b.item_id, "item_id");
  await validatePair(lid, iid, true);
  const amount = price(b.price_clp),
    enabled = b.active === undefined ? true : bool(b.active);
  const [record, created] = await PosLocationPrice.findOrCreate({
    where: { location_id: lid, item_id: iid },
    defaults: {
      location_id: lid,
      item_id: iid,
      price_clp: amount,
      active: enabled,
    },
  });
  if (!created) await record.update({ price_clp: amount, active: enabled });
  return record;
}
export async function updateLocationPrice(id: unknown, raw: unknown) {
  const key = uuid(id, "id"),
    b = body(raw),
    record = await PosLocationPrice.findByPk(key);
  if (!record) throw new PriceError(404, "Precio local no encontrado");
  if ("location_id" in b && b.location_id !== record.location_id)
    throw new PriceError(400, "No se permite cambiar el local");
  if ("item_id" in b && b.item_id !== record.item_id)
    throw new PriceError(400, "No se permite cambiar el artículo");
  const changes: { price_clp?: number; active?: boolean } = {};
  if ("price_clp" in b) changes.price_clp = price(b.price_clp);
  if ("active" in b) changes.active = bool(b.active);
  if (changes.active === true)
    await validatePair(record.location_id, record.item_id, true);
  await record.update(changes);
  return record;
}
export function handleLocationPriceError(error: unknown) {
  if (error instanceof PriceError)
    return { status: error.status, message: error.message };
  if (error instanceof UniqueConstraintError)
    return { status: 409, message: "Precio duplicado" };
  console.error("POS price error", error);
  return { status: 500, message: "Error interno de precios POS" };
}

import { Op, UniqueConstraintError } from "sequelize";
import {
  PosOrganization,
  PosLocation,
  PosTaxProfile,
  PosTerminal,
} from "../../models/index.js";
import {
  formatRut,
  isValidRut,
  isValidEmail,
  normalizeCode,
  normalizeText,
} from "../../utils/validators.js";

export class PosError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
const obj = (v: unknown): Record<string, unknown> => {
  if (!v || typeof v !== "object" || Array.isArray(v))
    throw new PosError(400, "El cuerpo debe ser un objeto JSON");
  return v as Record<string, unknown>;
};
const required = (v: unknown, name: string, max = 200) => {
  if (typeof v !== "string" || !v.trim() || v.trim().length > max)
    throw new PosError(400, `${name} obligatorio (máximo ${max} caracteres)`);
  return normalizeText(v);
};
const optional = (v: unknown, name: string, max = 500): string | null => {
  if (v == null) return null;
  if (typeof v !== "string" || v.trim().length > max)
    throw new PosError(400, `${name} inválido`);
  return v.trim() ? normalizeText(v) : null;
};
const uuid = (v: unknown, name: string) => {
  if (
    typeof v !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      v,
    )
  )
    throw new PosError(400, `${name} debe ser UUID válido`);
  return v;
};
const active = (v: unknown) => {
  if (typeof v !== "boolean")
    throw new PosError(400, "active debe ser booleano");
  return v;
};
const code = (v: unknown) => normalizeCode(required(v, "code", 50));
const ensureOrg = async (id: string) => {
  const org = await PosOrganization.findByPk(id);
  if (!org) throw new PosError(404, "Organización no encontrada");
  return org;
};
const ensureLocation = async (id: string) => {
  const loc = await PosLocation.findByPk(id);
  if (!loc) throw new PosError(404, "Local no encontrado");
  return loc;
};
const ensureTax = async (id: string) => {
  const tax = await PosTaxProfile.findByPk(id);
  if (!tax) throw new PosError(404, "Perfil tributario no encontrado");
  return tax;
};
const ensureTerminal = async (id: string) => {
  const terminal = await PosTerminal.findByPk(id);
  if (!terminal) throw new PosError(404, "Terminal no encontrado");
  return terminal;
};
export async function listTaxProfiles(organizationId?: unknown) {
  const where =
    organizationId === undefined
      ? {}
      : { organization_id: uuid(organizationId, "organization_id") };
  return PosTaxProfile.findAll({ where, order: [["name", "ASC"]] });
}
export async function getTaxProfile(id: string) {
  return ensureTax(uuid(id, "id"));
}
export async function createTaxProfile(raw: unknown) {
  const b = obj(raw);
  const organization_id = uuid(b.organization_id, "organization_id");
  const org = await ensureOrg(organization_id);
  if (!org.active) throw new PosError(409, "La organización está inactiva");
  const rut = required(b.rut, "rut", 20);
  if (!isValidRut(rut)) throw new PosError(400, "RUT inválido");
  const dte_email = optional(b.dte_email, "dte_email", 150);
  if (dte_email && !isValidEmail(dte_email))
    throw new PosError(400, "Correo DTE inválido");
  const data = {
    organization_id,
    name: required(b.name, "name", 150),
    rut: formatRut(rut),
    legal_name: required(b.legal_name, "legal_name", 200),
    business_activity: optional(b.business_activity, "business_activity"),
    address: optional(b.address, "address", 500),
    commune: optional(b.commune, "commune", 100),
    city: optional(b.city, "city", 100),
    dte_email: dte_email?.toLowerCase() ?? null,
    active: b.active === undefined ? true : active(b.active),
  };
  if (
    await PosTaxProfile.findOne({ where: { organization_id, rut: data.rut } })
  )
    throw new PosError(409, "El RUT ya existe en la organización");
  return PosTaxProfile.create(data);
}
export async function updateTaxProfile(id: string, raw: unknown) {
  const tax = await ensureTax(uuid(id, "id"));
  const b = obj(raw);
  if ("organization_id" in b && b.organization_id !== tax.organization_id)
    throw new PosError(400, "No se permite cambiar la organización");
  const changes: Record<string, unknown> = {};
  for (const [key, max] of [
    ["name", 150],
    ["legal_name", 200],
  ] as const)
    if (key in b) changes[key] = required(b[key], key, max);
  for (const [key, max] of [
    ["business_activity", 500],
    ["address", 500],
    ["commune", 100],
    ["city", 100],
    ["dte_email", 150],
  ] as const)
    if (key in b) changes[key] = optional(b[key], key, max);
  if ("dte_email" in changes && changes.dte_email) {
    if (!isValidEmail(changes.dte_email as string))
      throw new PosError(400, "Correo DTE inválido");
    changes.dte_email = (changes.dte_email as string).toLowerCase();
  }
  if ("rut" in b) {
    const rut = required(b.rut, "rut", 20);
    if (!isValidRut(rut)) throw new PosError(400, "RUT inválido");
    changes.rut = formatRut(rut);
    const other = await PosTaxProfile.findOne({
      where: {
        organization_id: tax.organization_id,
        rut: changes.rut as string,
        id: { [Op.ne]: tax.id },
      },
    });
    if (other) throw new PosError(409, "El RUT ya existe en la organización");
  }
  if ("active" in b) {
    changes.active = active(b.active);
    if (
      !changes.active &&
      (await PosLocation.count({
        where: { tax_profile_id: tax.id, active: true },
      }))
    )
      throw new PosError(409, "El perfil está asignado a locales activos");
  }
  await tax.update(changes);
  return tax;
}

/**
 * Consulta terminales de un local, de una organización, o ambas condiciones.
 * La organización se resuelve a través de pos_locations.
 */
export async function listTerminals(
  locationId?: unknown,
  organizationId?: unknown,
) {
  const location_id =
    locationId === undefined ? undefined : uuid(locationId, "location_id");
  const organization_id =
    organizationId === undefined
      ? undefined
      : uuid(organizationId, "organization_id");

  if (organization_id !== undefined) await ensureOrg(organization_id);

  if (location_id !== undefined) {
    const loc = await ensureLocation(location_id);
    if (
      organization_id !== undefined &&
      loc.organization_id !== organization_id
    ) {
      throw new PosError(
        400,
        "El local no pertenece a la organización indicada",
      );
    }
  }

  const where = location_id === undefined ? {} : { location_id };
  if (organization_id === undefined) {
    return PosTerminal.findAll({
      where,
      order: [
        ["name", "ASC"],
        ["id", "ASC"],
      ],
    });
  }

  return PosTerminal.findAll({
    where,
    include: [
      {
        model: PosLocation,
        as: "location",
        required: true,
        attributes: ["id", "name", "code", "organization_id"],
        where: { organization_id },
      },
    ],
    order: [
      ["name", "ASC"],
      ["id", "ASC"],
    ],
  });
}
export async function getTerminal(id: string) {
  return ensureTerminal(uuid(id, "id"));
}
export async function createTerminal(raw: unknown) {
  const b = obj(raw);
  const location_id = uuid(b.location_id, "location_id");
  const loc = await ensureLocation(location_id);
  if (!loc.active || !(await ensureOrg(loc.organization_id)).active)
    throw new PosError(409, "El local o su organización están inactivos");
  const data = {
    location_id,
    name: required(b.name, "name", 150),
    code: code(b.code),
    active: b.active === undefined ? true : active(b.active),
  };
  if (await PosTerminal.findOne({ where: { location_id, code: data.code } }))
    throw new PosError(409, "Código de terminal duplicado en el local");
  return PosTerminal.create(data);
}
export async function updateTerminal(id: string, raw: unknown) {
  const terminal = await ensureTerminal(uuid(id, "id"));
  const b = obj(raw);
  if ("location_id" in b && b.location_id !== terminal.location_id)
    throw new PosError(400, "No se permite cambiar el local");
  const changes: Record<string, unknown> = {};
  if ("name" in b) changes.name = required(b.name, "name", 150);
  if ("code" in b) {
    changes.code = code(b.code);
    if (
      await PosTerminal.findOne({
        where: {
          location_id: terminal.location_id,
          code: changes.code as string,
          id: { [Op.ne]: terminal.id },
        },
      })
    )
      throw new PosError(409, "Código de terminal duplicado en el local");
  }
  if ("active" in b) {
    changes.active = active(b.active);
    if (changes.active) {
      const loc = await ensureLocation(terminal.location_id);
      if (!loc.active || !(await ensureOrg(loc.organization_id)).active)
        throw new PosError(409, "El local o su organización están inactivos");
    }
  }
  await terminal.update(changes);
  return terminal;
}
export function handlePosError(error: unknown): {
  status: number;
  message: string;
} {
  if (error instanceof PosError)
    return { status: error.status, message: error.message };
  if (error instanceof UniqueConstraintError)
    return { status: 409, message: "Registro duplicado" };
  console.error("POS resources error:", error);
  return { status: 500, message: "Error interno del módulo POS" };
}

import { Op, UniqueConstraintError } from "sequelize";
import { PosOrganization, PosLocation, PosTaxProfile } from "../../models/index.js";

export class PosConfigError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

type Payload = Record<string, unknown>;
const uuid = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
function required(v: unknown, key: string, max: number): string {
  if (typeof v !== "string" || !v.trim() || v.trim().length > max) throw new PosConfigError(400, `${key} es obligatorio (máximo ${max} caracteres)`);
  return v.trim();
}
function optional(v: unknown, key: string, max: number): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v !== "string" || v.trim().length > max) throw new PosConfigError(400, `${key} debe ser texto de máximo ${max} caracteres`);
  return v.trim() || null;
}
function bool(v: unknown): boolean | undefined {
  if (v === undefined) return undefined;
  if (typeof v !== "boolean") throw new PosConfigError(400, "active debe ser booleano");
  return v;
}
function checkId(id: string) { if (!uuid(id)) throw new PosConfigError(400, "Identificador UUID inválido"); }
function handleUnique(e: unknown): never {
  if (e instanceof UniqueConstraintError) throw new PosConfigError(409, "Ya existe un registro con ese código en el ámbito indicado");
  throw e;
}
export async function listOrganizations() { return PosOrganization.findAll({ order: [["name", "ASC"]] }); }
export async function getOrganization(id: string) {
  checkId(id);
  const org = await PosOrganization.findByPk(id, { include: [{ model: PosLocation, as: "locations" }, { model: PosTaxProfile, as: "tax_profiles" }] });
  if (!org) throw new PosConfigError(404, "Organización no encontrada");
  return org;
}
export async function createOrganization(body: Payload) {
  try { return await PosOrganization.create({ name: required(body.name, "name", 150), code: required(body.code, "code", 50).toUpperCase(), active: bool(body.active) ?? true }); }
  catch (e) { handleUnique(e); }
}
export async function updateOrganization(id: string, body: Payload) {
  const org = await getOrganization(id);
  const patch: Partial<{ name: string; code: string; active: boolean }> = {};
  if (body.name !== undefined) patch.name = required(body.name, "name", 150);
  if (body.code !== undefined) patch.code = required(body.code, "code", 50).toUpperCase();
  if (body.active !== undefined) patch.active = bool(body.active);
  try { await org.update(patch); return getOrganization(id); }
  catch (e) { handleUnique(e); }
}
export async function listLocations(organizationId?: string) {
  if (organizationId) checkId(organizationId);
  return PosLocation.findAll({ where: organizationId ? { organization_id: organizationId } : {}, include: [{ model: PosOrganization, as: "organization" }, { model: PosTaxProfile, as: "tax_profile" }], order: [["name", "ASC"]] });
}
export async function getLocation(id: string) {
  checkId(id);
  const location = await PosLocation.findByPk(id, { include: [{ model: PosOrganization, as: "organization" }, { model: PosTaxProfile, as: "tax_profile" }] });
  if (!location) throw new PosConfigError(404, "Local no encontrado");
  return location;
}
async function validateTaxProfile(organizationId: string, profileId: string | null) {
  if (profileId === null) return;
  checkId(profileId);
  const profile = await PosTaxProfile.findByPk(profileId);
  if (!profile || !profile.active || profile.organization_id !== organizationId) throw new PosConfigError(400, "El perfil tributario debe estar activo y pertenecer a la organización");
}
export async function createLocation(body: Payload) {
  if (!uuid(body.organization_id)) throw new PosConfigError(400, "organization_id debe ser UUID válido");
  const org = await PosOrganization.findByPk(body.organization_id);
  if (!org || !org.active) throw new PosConfigError(400, "La organización no existe o está inactiva");
  const taxId = optional(body.tax_profile_id, "tax_profile_id", 36);
  await validateTaxProfile(org.id, taxId);
  try {
    return await PosLocation.create({
      organization_id: org.id, tax_profile_id: taxId,
      name: required(body.name, "name", 150), code: required(body.code, "code", 50).toUpperCase(),
      address: optional(body.address, "address", 10000), commune: optional(body.commune, "commune", 100), city: optional(body.city, "city", 100),
      active: bool(body.active) ?? true,
    });
  } catch (e) { handleUnique(e); }
}
export async function updateLocation(id: string, body: Payload) {
  const location = await getLocation(id);
  if (body.organization_id !== undefined && body.organization_id !== location.organization_id) throw new PosConfigError(400, "No se permite cambiar la organización de un local");
  const patch: Partial<{ name: string; code: string; tax_profile_id: string | null; address: string | null; commune: string | null; city: string | null; active: boolean }> = {};
  if (body.name !== undefined) patch.name = required(body.name, "name", 150);
  if (body.code !== undefined) patch.code = required(body.code, "code", 50).toUpperCase();
  if (body.address !== undefined) patch.address = optional(body.address, "address", 10000);
  if (body.commune !== undefined) patch.commune = optional(body.commune, "commune", 100);
  if (body.city !== undefined) patch.city = optional(body.city, "city", 100);
  if (body.active !== undefined) patch.active = bool(body.active);
  if (body.tax_profile_id !== undefined) {
    const taxId = optional(body.tax_profile_id, "tax_profile_id", 36);
    await validateTaxProfile(location.organization_id, taxId);
    patch.tax_profile_id = taxId;
  }
  try { await location.update(patch); return getLocation(id); }
  catch (e) { handleUnique(e); }
}

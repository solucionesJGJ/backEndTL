import type { Request, Response } from "express";
import { Op } from "sequelize";

import {
  Client,
  ClientEconomicActivity,
  EconomicActivity,
  sequelize,
} from "../models/index.js";

import {
  formatRut,
  isNonEmptyString,
  isValidEmail,
  isValidPhoneCL,
  isValidRut,
  normalizeText,
} from "../utils/validators.js";

function clientInclude() {
  return [
    {
      model: ClientEconomicActivity,
      as: "economic_activity_links",
      include: [
        {
          model: EconomicActivity,
          as: "economic_activity",
        },
      ],
    },
  ];
}

function normalizeEconomicActivityIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return [
    ...new Set(
      value.filter(
        (item): item is string =>
          typeof item === "string" && item.trim().length > 0,
      ),
    ),
  ];
}

async function validateEconomicActivities(
  activityIds: string[],
  dteActivityId: string | null,
) {
  if (activityIds.length === 0) {
    return {
      activities: [] as EconomicActivity[],
      dteActivity: null as EconomicActivity | null,
    };
  }

  const activities = await EconomicActivity.findAll({
    where: {
      id: {
        [Op.in]: activityIds,
      },
      active: true,
    },
  });

  if (activities.length !== activityIds.length) {
    throw new Error("INVALID_ECONOMIC_ACTIVITIES");
  }

  let dteActivity: EconomicActivity | null = null;

  if (dteActivityId) {
    if (!activityIds.includes(dteActivityId)) {
      throw new Error("INVALID_DTE_ACTIVITY");
    }

    dteActivity =
      activities.find((activity) => activity.id === dteActivityId) || null;

    if (!dteActivity) {
      throw new Error("INVALID_DTE_ACTIVITY");
    }
  }

  return {
    activities,
    dteActivity,
  };
}

export async function createClient(req: Request, res: Response) {
  const transaction = await sequelize.transaction();

  try {
    const {
      name,
      rut,
      legal_name,
      address,
      commune,
      city,
      dte_email,
      contact_name,
      contact_email,
      contact_phone,
      code_prefix,
      economic_activity_ids,
      dte_economic_activity_id,
    } = req.body;

    if (
      !isNonEmptyString(name) ||
      !isNonEmptyString(rut) ||
      !isNonEmptyString(contact_name) ||
      !isNonEmptyString(contact_email) ||
      !isNonEmptyString(contact_phone)
    ) {
      await transaction.rollback();

      return res.status(400).json({
        ok: false,
        message: "Nombre, RUT y datos de contacto son obligatorios",
      });
    }

    if (!isValidRut(rut)) {
      await transaction.rollback();

      return res.status(400).json({
        ok: false,
        message: "El RUT ingresado no es valido",
      });
    }

    if (!isValidEmail(contact_email)) {
      await transaction.rollback();

      return res.status(400).json({
        ok: false,
        message: "El email de contacto no es valido",
      });
    }

    if (isNonEmptyString(dte_email) && !isValidEmail(dte_email)) {
      await transaction.rollback();

      return res.status(400).json({
        ok: false,
        message: "El email DTE no es valido",
      });
    }

    if (!isValidPhoneCL(contact_phone)) {
      await transaction.rollback();

      return res.status(400).json({
        ok: false,
        message: "El telefono debe tener formato chileno valido",
      });
    }

    const normalizedRut = formatRut(rut);

    const existingClient = await Client.findOne({
      where: {
        rut: normalizedRut,
      },
      transaction,
    });

    if (existingClient) {
      await transaction.rollback();

      return res.status(409).json({
        ok: false,
        message: "Ya existe un cliente con ese RUT",
      });
    }

    if (isNonEmptyString(code_prefix)) {
      const existingCodePrefix = await Client.findOne({
        where: {
          code_prefix: code_prefix.trim().toUpperCase(),
        },
        transaction,
      });

      if (existingCodePrefix) {
        await transaction.rollback();

        return res.status(409).json({
          ok: false,
          message: "Ya existe un cliente con ese prefijo de código",
        });
      }
    }

    const activityIds = normalizeEconomicActivityIds(economic_activity_ids);

    const dteActivityId = isNonEmptyString(dte_economic_activity_id)
      ? dte_economic_activity_id.trim()
      : null;

    const { dteActivity } = await validateEconomicActivities(
      activityIds,
      dteActivityId,
    );

    const client = await Client.create(
      {
        name: normalizeText(name),
        rut: normalizedRut,

        legal_name: isNonEmptyString(legal_name)
          ? normalizeText(legal_name)
          : null,

        business_activity: dteActivity?.description || null,

        address: isNonEmptyString(address) ? normalizeText(address) : null,
        commune: isNonEmptyString(commune) ? normalizeText(commune) : null,
        city: isNonEmptyString(city) ? normalizeText(city) : null,

        dte_email: isNonEmptyString(dte_email)
          ? dte_email.trim().toLowerCase()
          : null,

        contact_name: normalizeText(contact_name),
        contact_email: contact_email.trim().toLowerCase(),
        contact_phone: contact_phone.trim(),

        code_prefix: isNonEmptyString(code_prefix)
          ? code_prefix.trim().toUpperCase()
          : null,

        active: true,
      },
      {
        transaction,
      },
    );

    if (activityIds.length > 0) {
      await ClientEconomicActivity.bulkCreate(
        activityIds.map((economicActivityId) => ({
          client_id: client.id,
          economic_activity_id: economicActivityId,
          is_dte_default: economicActivityId === dteActivityId,
        })),
        {
          transaction,
        },
      );
    }

    await transaction.commit();

    const createdClient = await Client.findByPk(client.id, {
      include: clientInclude(),
    });

    return res.status(201).json({
      ok: true,
      message: "Cliente creado correctamente",
      data: createdClient,
    });
  } catch (error) {
    await transaction.rollback();

    if (error instanceof Error) {
      if (error.message === "INVALID_ECONOMIC_ACTIVITIES") {
        return res.status(400).json({
          ok: false,
          message: "Una o más actividades económicas no son válidas",
        });
      }

      if (error.message === "INVALID_DTE_ACTIVITY") {
        return res.status(400).json({
          ok: false,
          message:
            "La actividad DTE debe pertenecer a las actividades del cliente",
        });
      }
    }

    console.error(error);

    return res.status(500).json({
      ok: false,
      message: "Error creando cliente",
    });
  }
}

export async function getClients(req: Request, res: Response) {
  try {
    const clients = await Client.findAll({
      include: clientInclude(),
      order: [["createdAt", "DESC"]],
    });

    return res.json({
      ok: true,
      data: clients,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      ok: false,
      message: "Error obteniendo clientes",
    });
  }
}

export async function getClientById(req: Request, res: Response) {
  try {
    const id = req.params.id as string;

    const client = await Client.findByPk(id, {
      include: clientInclude(),
    });

    if (!client) {
      return res.status(404).json({
        ok: false,
        message: "Cliente no encontrado",
      });
    }

    return res.json({
      ok: true,
      data: client,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      ok: false,
      message: "Error obteniendo cliente",
    });
  }
}

export async function updateClient(req: Request, res: Response) {
  const transaction = await sequelize.transaction();

  try {
    const id = req.params.id as string;

    const {
      name,
      rut,
      legal_name,
      address,
      commune,
      city,
      dte_email,
      contact_name,
      contact_email,
      contact_phone,
      active,
      code_prefix,
      economic_activity_ids,
      dte_economic_activity_id,
    } = req.body;

    const client = await Client.findByPk(id, {
      transaction,
    });

    if (!client) {
      await transaction.rollback();

      return res.status(404).json({
        ok: false,
        message: "Cliente no encontrado",
      });
    }

    if (
      !isNonEmptyString(name) ||
      !isNonEmptyString(rut) ||
      !isNonEmptyString(contact_name) ||
      !isNonEmptyString(contact_email) ||
      !isNonEmptyString(contact_phone)
    ) {
      await transaction.rollback();

      return res.status(400).json({
        ok: false,
        message: "Nombre, RUT y datos de contacto son obligatorios",
      });
    }

    if (!isValidRut(rut)) {
      await transaction.rollback();

      return res.status(400).json({
        ok: false,
        message: "El RUT ingresado no es valido",
      });
    }

    if (!isValidEmail(contact_email)) {
      await transaction.rollback();

      return res.status(400).json({
        ok: false,
        message: "El email de contacto no es valido",
      });
    }

    if (isNonEmptyString(dte_email) && !isValidEmail(dte_email)) {
      await transaction.rollback();

      return res.status(400).json({
        ok: false,
        message: "El email DTE no es valido",
      });
    }

    if (!isValidPhoneCL(contact_phone)) {
      await transaction.rollback();

      return res.status(400).json({
        ok: false,
        message: "El telefono debe tener formato chileno valido",
      });
    }

    const normalizedRut = formatRut(rut);

    const existingClient = await Client.findOne({
      where: {
        rut: normalizedRut,
        id: {
          [Op.ne]: id,
        },
      },
      transaction,
    });

    if (existingClient) {
      await transaction.rollback();

      return res.status(409).json({
        ok: false,
        message: "Ya existe otro cliente con ese RUT",
      });
    }

    if (isNonEmptyString(code_prefix)) {
      const existingCodePrefix = await Client.findOne({
        where: {
          code_prefix: code_prefix.trim().toUpperCase(),
          id: {
            [Op.ne]: id,
          },
        },
        transaction,
      });

      if (existingCodePrefix) {
        await transaction.rollback();

        return res.status(409).json({
          ok: false,
          message: "Ya existe otro cliente con ese prefijo de código",
        });
      }
    }

    const activityIds = normalizeEconomicActivityIds(economic_activity_ids);

    const dteActivityId = isNonEmptyString(dte_economic_activity_id)
      ? dte_economic_activity_id.trim()
      : null;

    const { dteActivity } = await validateEconomicActivities(
      activityIds,
      dteActivityId,
    );

    await client.update(
      {
        name: normalizeText(name),
        rut: normalizedRut,

        legal_name: isNonEmptyString(legal_name)
          ? normalizeText(legal_name)
          : null,

        business_activity: dteActivity?.description || null,

        address: isNonEmptyString(address) ? normalizeText(address) : null,
        commune: isNonEmptyString(commune) ? normalizeText(commune) : null,
        city: isNonEmptyString(city) ? normalizeText(city) : null,

        dte_email: isNonEmptyString(dte_email)
          ? dte_email.trim().toLowerCase()
          : null,

        contact_name: normalizeText(contact_name),
        contact_email: contact_email.trim().toLowerCase(),
        contact_phone: contact_phone.trim(),

        code_prefix: isNonEmptyString(code_prefix)
          ? code_prefix.trim().toUpperCase()
          : null,

        active: typeof active === "boolean" ? active : client.active,
      },
      {
        transaction,
      },
    );

    await ClientEconomicActivity.destroy({
      where: {
        client_id: client.id,
      },
      transaction,
    });

    if (activityIds.length > 0) {
      await ClientEconomicActivity.bulkCreate(
        activityIds.map((economicActivityId) => ({
          client_id: client.id,
          economic_activity_id: economicActivityId,
          is_dte_default: economicActivityId === dteActivityId,
        })),
        {
          transaction,
        },
      );
    }

    await transaction.commit();

    const updatedClient = await Client.findByPk(client.id, {
      include: clientInclude(),
    });

    return res.json({
      ok: true,
      message: "Cliente actualizado correctamente",
      data: updatedClient,
    });
  } catch (error) {
    await transaction.rollback();

    if (error instanceof Error) {
      if (error.message === "INVALID_ECONOMIC_ACTIVITIES") {
        return res.status(400).json({
          ok: false,
          message: "Una o más actividades económicas no son válidas",
        });
      }

      if (error.message === "INVALID_DTE_ACTIVITY") {
        return res.status(400).json({
          ok: false,
          message:
            "La actividad DTE debe pertenecer a las actividades del cliente",
        });
      }
    }

    console.error(error);

    return res.status(500).json({
      ok: false,
      message: "Error actualizando cliente",
    });
  }
}
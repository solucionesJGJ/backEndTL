import type { Request, Response } from "express";

import { Client } from "../models/index.js";

import { Op } from "sequelize";

import {
  formatRut,
  isNonEmptyString,
  isValidEmail,
  isValidPhoneCL,
  isValidRut,
  normalizeText,
} from "../utils/validators.js";

/**
 * =========================================================
 * CREAR CLIENTE
 * =========================================================
 */
export async function createClient(req: Request, res: Response) {
  try {
    const {
      name,
      rut,

      legal_name,
      business_activity,

      address,
      commune,
      city,

      dte_email,

      contact_name,
      contact_email,
      contact_phone,

      code_prefix,
    } = req.body;

    /**
     * Campos mínimos operacionales
     * que TL ya exigía.
     */
    if (
      !isNonEmptyString(name) ||
      !isNonEmptyString(rut) ||
      !isNonEmptyString(contact_name) ||
      !isNonEmptyString(contact_email) ||
      !isNonEmptyString(contact_phone)
    ) {
      return res.status(400).json({
        ok: false,
        message: "Nombre, RUT y datos de contacto son obligatorios",
      });
    }

    if (!isValidRut(rut)) {
      return res.status(400).json({
        ok: false,
        message: "El RUT ingresado no es valido",
      });
    }

    if (!isValidEmail(contact_email)) {
      return res.status(400).json({
        ok: false,
        message: "El email de contacto no es valido",
      });
    }

    /**
     * Email DTE es opcional,
     * pero si viene debe ser válido.
     */
    if (isNonEmptyString(dte_email) && !isValidEmail(dte_email)) {
      return res.status(400).json({
        ok: false,
        message: "El email DTE no es valido",
      });
    }

    if (!isValidPhoneCL(contact_phone)) {
      return res.status(400).json({
        ok: false,
        message: "El telefono debe tener formato chileno valido",
      });
    }

    const normalizedRut = formatRut(rut);

    const normalizedEmail = contact_email.trim().toLowerCase();

    const normalizedDteEmail = isNonEmptyString(dte_email)
      ? dte_email.trim().toLowerCase()
      : null;

    /**
     * Validar RUT único.
     */
    const existingClient = await Client.findOne({
      where: {
        rut: normalizedRut,
      },
    });

    if (existingClient) {
      return res.status(409).json({
        ok: false,
        message: "Ya existe un cliente con ese RUT",
      });
    }

    /**
     * Prefijo opcional,
     * pero si existe debe ser único.
     */
    if (isNonEmptyString(code_prefix)) {
      const existingCodePrefix = await Client.findOne({
        where: {
          code_prefix: code_prefix.trim().toUpperCase(),
        },
      });

      if (existingCodePrefix) {
        return res.status(409).json({
          ok: false,
          message: "Ya existe un cliente con ese prefijo de código",
        });
      }
    }

    const client = await Client.create({
      /**
       * Identificación TL.
       */
      name: normalizeText(name),

      rut: normalizedRut,

      /**
       * Datos tributarios.
       */
      legal_name: isNonEmptyString(legal_name)
        ? normalizeText(legal_name)
        : null,

      business_activity: isNonEmptyString(business_activity)
        ? normalizeText(business_activity)
        : null,

      address: isNonEmptyString(address) ? normalizeText(address) : null,

      commune: isNonEmptyString(commune) ? normalizeText(commune) : null,

      city: isNonEmptyString(city) ? normalizeText(city) : null,

      dte_email: normalizedDteEmail,

      /**
       * Contacto.
       */
      contact_name: normalizeText(contact_name),

      contact_email: normalizedEmail,

      contact_phone: contact_phone.trim(),

      /**
       * Prendas.
       */
      code_prefix: isNonEmptyString(code_prefix)
        ? code_prefix.trim().toUpperCase()
        : null,

      active: true,
    });

    return res.status(201).json({
      ok: true,
      message: "Cliente creado correctamente",
      data: client,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      ok: false,
      message: "Error creando cliente",
    });
  }
}

/**
 * =========================================================
 * LISTAR CLIENTES
 * =========================================================
 */
export async function getClients(req: Request, res: Response) {
  try {
    const clients = await Client.findAll({
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

/**
 * =========================================================
 * OBTENER CLIENTE
 * =========================================================
 */
export async function getClientById(req: Request, res: Response) {
  try {
    const id = req.params.id as string;

    const client = await Client.findByPk(id);

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

/**
 * =========================================================
 * ACTUALIZAR CLIENTE
 * =========================================================
 */
export async function updateClient(req: Request, res: Response) {
  try {
    const id = req.params.id as string;

    const {
      name,
      rut,

      legal_name,
      business_activity,

      address,
      commune,
      city,

      dte_email,

      contact_name,
      contact_email,
      contact_phone,

      active,
      code_prefix,
    } = req.body;

    const client = await Client.findByPk(id);

    if (!client) {
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
      return res.status(400).json({
        ok: false,
        message: "Nombre, RUT y datos de contacto son obligatorios",
      });
    }

    if (!isValidRut(rut)) {
      return res.status(400).json({
        ok: false,
        message: "El RUT ingresado no es valido",
      });
    }

    if (!isValidEmail(contact_email)) {
      return res.status(400).json({
        ok: false,
        message: "El email de contacto no es valido",
      });
    }

    if (isNonEmptyString(dte_email) && !isValidEmail(dte_email)) {
      return res.status(400).json({
        ok: false,
        message: "El email DTE no es valido",
      });
    }

    if (!isValidPhoneCL(contact_phone)) {
      return res.status(400).json({
        ok: false,
        message: "El telefono debe tener formato chileno valido",
      });
    }

    const normalizedRut = formatRut(rut);

    /**
     * Validar RUT único,
     * excluyendo cliente actual.
     */
    const existingClient = await Client.findOne({
      where: {
        rut: normalizedRut,

        id: {
          [Op.ne]: id,
        },
      },
    });

    if (existingClient) {
      return res.status(409).json({
        ok: false,
        message: "Ya existe otro cliente con ese RUT",
      });
    }

    /**
     * Validar prefijo único,
     * excluyendo cliente actual.
     */
    if (isNonEmptyString(code_prefix)) {
      const existingCodePrefix = await Client.findOne({
        where: {
          code_prefix: code_prefix.trim().toUpperCase(),

          id: {
            [Op.ne]: id,
          },
        },
      });

      if (existingCodePrefix) {
        return res.status(409).json({
          ok: false,
          message: "Ya existe otro cliente con ese prefijo de código",
        });
      }
    }

    await client.update({
      name: normalizeText(name),

      rut: normalizedRut,

      /**
       * Datos tributarios.
       */
      legal_name: isNonEmptyString(legal_name)
        ? normalizeText(legal_name)
        : null,

      business_activity: isNonEmptyString(business_activity)
        ? normalizeText(business_activity)
        : null,

      address: isNonEmptyString(address) ? normalizeText(address) : null,

      commune: isNonEmptyString(commune) ? normalizeText(commune) : null,

      city: isNonEmptyString(city) ? normalizeText(city) : null,

      dte_email: isNonEmptyString(dte_email)
        ? dte_email.trim().toLowerCase()
        : null,

      /**
       * Contacto.
       */
      contact_name: normalizeText(contact_name),

      contact_email: contact_email.trim().toLowerCase(),

      contact_phone: contact_phone.trim(),

      code_prefix: isNonEmptyString(code_prefix)
        ? code_prefix.trim().toUpperCase()
        : null,

      active: typeof active === "boolean" ? active : client.active,
    });

    return res.json({
      ok: true,
      message: "Cliente actualizado correctamente",
      data: client,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      ok: false,
      message: "Error actualizando cliente",
    });
  }
}

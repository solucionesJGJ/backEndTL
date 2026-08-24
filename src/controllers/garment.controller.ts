import { Op } from "sequelize";
import type { Request, Response } from "express";

import {
  sequelize,
  Garment,
  Client,
  GarmentPriceHistory,
} from "../models/index.js";

import {
  isNonEmptyString,
  isOptionalNonNegativeNumber,
  normalizeText,
} from "../utils/validators.js";


/**
 * Normaliza un prefijo.
 *
 * Ej:
 * "ah" -> "AH"
 */
function normalizePrefix(prefix: string): string {
  return prefix
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}


/**
 * Normaliza la parte manual del código.
 *
 * " sk-01 " -> "SK-01"
 */
function normalizeManualCode(code: string): string {
  return code
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}


/**
 * Construye código definitivo.
 *
 * AH + SK01
 * =
 * AH-SK01
 */
function buildGarmentCode(
  prefix: string,
  manualCode: string
): string {

  return `${normalizePrefix(prefix)}-${normalizeManualCode(manualCode)}`;
}


/**
 * GET /garments
 */
export async function getGarments(
  req: Request,
  res: Response
) {
  try {

    const garments = await Garment.findAll({
      include: [
        {
          model: Client,
          as: "client",
          attributes: [
            "id",
            "name",
            "code_prefix",
          ],
        },
      ],

      order: [["createdAt", "DESC"]],
    });

    return res.json({
      ok: true,
      data: garments,
    });

  } catch (error) {

    console.error(error);

    return res.status(500).json({
      ok: false,
      message: "Error obteniendo prendas",
    });
  }
}


/**
 * GET /garments/:id
 */
export async function getGarmentById(
  req: Request,
  res: Response
) {
  try {

    const id = req.params.id as string;

    const garment = await Garment.findByPk(id, {
      include: [
        {
          model: Client,
          as: "client",
          attributes: [
            "id",
            "name",
            "code_prefix",
          ],
        },

        {
          model: GarmentPriceHistory,
          as: "price_history",
        },
      ],
    });

    if (!garment) {
      return res.status(404).json({
        ok: false,
        message: "Prenda no encontrada",
      });
    }

    return res.json({
      ok: true,
      data: garment,
    });

  } catch (error) {

    console.error(error);

    return res.status(500).json({
      ok: false,
      message: "Error obteniendo prenda",
    });
  }
}


/**
 * POST /garments
 */
export async function createGarment(
  req: Request,
  res: Response
) {
  try {

    const {
      client_id,
      code,
      description,
      size,
      color,
      barcode,
      value,
    } = req.body;


    /**
     * Validaciones básicas
     */

    if (
      !isNonEmptyString(client_id) ||
      !isNonEmptyString(code)
    ) {
      return res.status(400).json({
        ok: false,
        message: "client_id y code son obligatorios",
      });
    }


    if (!isOptionalNonNegativeNumber(value)) {
      return res.status(400).json({
        ok: false,
        message: "El valor de la prenda no puede ser negativo",
      });
    }


    /**
     * Verificamos cliente
     */

    const client = await Client.findByPk(client_id);

    if (!client) {
      return res.status(404).json({
        ok: false,
        message: "Cliente no encontrado",
      });
    }


    if (!isNonEmptyString(client.code_prefix)) {
      return res.status(400).json({
        ok: false,
        message:
          "El cliente no tiene un prefijo de código configurado",
      });
    }


    /**
     * Construimos código definitivo
     */

    const finalCode = buildGarmentCode(
      client.code_prefix,
      code
    );


    const normalizedBarcode =
      isNonEmptyString(barcode)
        ? barcode.trim()
        : null;


    /**
     * Validamos código único
     */

    const existingCode = await Garment.findOne({
      where: {
        code: finalCode,
      },
    });

    if (existingCode) {
      return res.status(409).json({
        ok: false,
        message:
          `Ya existe una prenda con el código ${finalCode}`,
      });
    }


    /**
     * Código de barras
     */

    if (normalizedBarcode) {

      const existingBarcode =
        await Garment.findOne({
          where: {
            barcode: normalizedBarcode,
          },
        });

      if (existingBarcode) {
        return res.status(409).json({
          ok: false,
          message:
            "Ya existe una prenda con ese código de barra",
        });
      }
    }


    /**
     * Crear prenda
     */

    const garment = await Garment.create({

      client_id,

      code: finalCode,

      description:
        isNonEmptyString(description)
          ? normalizeText(description)
          : null,

      size:
        isNonEmptyString(size)
          ? normalizeText(size)
          : null,

      color:
        isNonEmptyString(color)
          ? normalizeText(color)
          : null,

      barcode: normalizedBarcode,

      value: Number(value || 0),

      active: true,
    });


    return res.status(201).json({
      ok: true,
      message: "Prenda creada correctamente",
      data: garment,
    });

  } catch (error) {

    console.error(error);

    return res.status(500).json({
      ok: false,
      message: "Error creando prenda",
    });
  }
}


/**
 * PUT /garments/:id
 */
export async function updateGarment(
  req: Request,
  res: Response
) {

  const transaction =
    await sequelize.transaction();

  try {

    const id = req.params.id as string;

    const {
      client_id,
      code,
      description,
      size,
      color,
      barcode,
      active,
      value,
    } = req.body;


    const garment =
      await Garment.findByPk(id, {
        transaction,
      });


    if (!garment) {

      await transaction.rollback();

      return res.status(404).json({
        ok: false,
        message: "Prenda no encontrada",
      });
    }


    if (
      !isNonEmptyString(client_id) ||
      !isNonEmptyString(code)
    ) {

      await transaction.rollback();

      return res.status(400).json({
        ok: false,
        message:
          "client_id y code son obligatorios",
      });
    }


    if (!isOptionalNonNegativeNumber(value)) {

      await transaction.rollback();

      return res.status(400).json({
        ok: false,
        message:
          "El valor de la prenda no puede ser negativo",
      });
    }


    /**
     * Cliente
     */

    const client =
      await Client.findByPk(client_id, {
        transaction,
      });


    if (!client) {

      await transaction.rollback();

      return res.status(404).json({
        ok: false,
        message: "Cliente no encontrado",
      });
    }


    if (!isNonEmptyString(client.code_prefix)) {

      await transaction.rollback();

      return res.status(400).json({
        ok: false,
        message:
          "El cliente no tiene un prefijo configurado",
      });
    }


    /**
     * Código definitivo
     */

    const finalCode =
      buildGarmentCode(
        client.code_prefix,
        code
      );


    const normalizedBarcode =
      isNonEmptyString(barcode)
        ? barcode.trim()
        : null;


    /**
     * Código duplicado
     */

    const existingCode =
      await Garment.findOne({
        where: {
          code: finalCode,
          id: {
            [Op.ne]: id,
          },
        },
        transaction,
      });


    if (existingCode) {

      await transaction.rollback();

      return res.status(409).json({
        ok: false,
        message:
          `Ya existe otra prenda con el código ${finalCode}`,
      });
    }


    /**
     * Barcode duplicado
     */

    if (normalizedBarcode) {

      const existingBarcode =
        await Garment.findOne({
          where: {
            barcode: normalizedBarcode,
            id: {
              [Op.ne]: id,
            },
          },
          transaction,
        });


      if (existingBarcode) {

        await transaction.rollback();

        return res.status(409).json({
          ok: false,
          message:
            "Ya existe otra prenda con ese código de barra",
        });
      }
    }


    /**
     * Historial de precio
     */

    const oldValue =
      Number(garment.value);

    const newValue =
      Number(value || 0);


    if (oldValue !== newValue) {

      /**
       * changed_by lo conectaremos al usuario
       * autenticado cuando revisemos el middleware.
       */

      await GarmentPriceHistory.create(
        {
          garment_id: garment.id,

          old_value: oldValue,

          new_value: newValue,

          changed_by: null,
        },
        {
          transaction,
        }
      );
    }


    /**
     * Actualización
     */

    await garment.update(
      {
        client_id,

        code: finalCode,

        description:
          isNonEmptyString(description)
            ? normalizeText(description)
            : null,

        size:
          isNonEmptyString(size)
            ? normalizeText(size)
            : null,

        color:
          isNonEmptyString(color)
            ? normalizeText(color)
            : null,

        barcode:
          normalizedBarcode,

        active:
          typeof active === "boolean"
            ? active
            : garment.active,

        value:
          newValue,
      },
      {
        transaction,
      }
    );


    await transaction.commit();


    return res.json({
      ok: true,
      message:
        "Prenda actualizada correctamente",
      data: garment,
    });

  } catch (error) {

    await transaction.rollback();

    console.error(error);

    return res.status(500).json({
      ok: false,
      message:
        "Error actualizando prenda",
    });
  }
}


/**
 * PATCH /garments/:id/deactivate
 */
export async function deactivateGarment(
  req: Request,
  res: Response
) {
  try {

    const id =
      req.params.id as string;

    const garment =
      await Garment.findByPk(id);

    if (!garment) {
      return res.status(404).json({
        ok: false,
        message:
          "Prenda no encontrada",
      });
    }

    await garment.update({
      active: false,
    });


    return res.json({
      ok: true,
      message:
        "Prenda desactivada correctamente",
      data: garment,
    });

  } catch (error) {

    console.error(error);

    return res.status(500).json({
      ok: false,
      message:
        "Error desactivando prenda",
    });
  }
}
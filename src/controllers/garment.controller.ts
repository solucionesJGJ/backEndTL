import { Op } from "sequelize";
import type { Request, Response } from "express";
import { Garment, GarmentType } from "../models/index.js";
import { isNonEmptyString, isOptionalNonNegativeNumber, normalizeText } from "../utils/validators.js";

export async function getGarments(req: Request, res: Response) {
  try {
    const garments = await Garment.findAll({
      include: [
        { model: GarmentType, as: "type", attributes: ["id", "name"] },
      ],
      order: [["createdAt", "DESC"]],
    });

    return res.json({ ok: true, data: garments });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ ok: false, message: "Error obteniendo prendas" });
  }
}

export async function getGarmentById(req: Request, res: Response) {
  try {
    const id = req.params.id as string;

    const garment = await Garment.findByPk(id, {
      include: [
        { model: GarmentType, as: "type", attributes: ["id", "name"] },
      ],
    });

    if (!garment) {
      return res.status(404).json({ ok: false, message: "Prenda no encontrada" });
    }

    return res.json({ ok: true, data: garment });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ ok: false, message: "Error obteniendo prenda" });
  }
}

export async function createGarment(req: Request, res: Response) {
  try {
    const {
      garment_type_id,
      code,
      description,
      size,
      color,
      barcode,
      value,
    } = req.body;

    /* if (!garment_type_id || !code?.trim()) {
      return res.status(400).json({
        ok: false,
        message: "client_id, garment_type_id y code son obligatorios",
      });
    }
 */
    /* const client = await Client.findByPk(client_id);
    if (!client) {
      return res.status(404).json({ ok: false, message: "Cliente no encontrado" });
    }
 */
    if (!isNonEmptyString(garment_type_id) || !isNonEmptyString(code)) {
      return res.status(400).json({
        ok: false,
        message: "garment_type_id y code son obligatorios",
      });
    }

    const garmentType = await GarmentType.findByPk(garment_type_id);
    if (!garmentType) {
      return res.status(404).json({ ok: false, message: "Tipo de prenda no encontrado" });
    }

    if (!isOptionalNonNegativeNumber(value)) {
      return res.status(400).json({
        ok: false,
        message: "El valor de la prenda no puede ser negativo",
      })
    }

    const normalizedCode = code.trim();
    const normalizedBarcode = isNonEmptyString(barcode) ? barcode.trim() : null;

    const existingCode = await Garment.findOne({
      where: {
        code: normalizedCode,
      },
    });

    if (existingCode) {
      return res.status(409).json({
        ok: false,
        message: "Ya existe una prenda con ese código para este cliente",
      });
    }

    if (normalizedBarcode) {
      const existingBarcode = await Garment.findOne({
        where: { barcode: normalizedBarcode },
      });

      if (existingBarcode) {
        return res.status(409).json({
          ok: false,
          message: "Ya existe una prenda con ese código de barra",
        });
      }
    }

    const garment = await Garment.create({
      garment_type_id,
      code: normalizedCode,
      description: isNonEmptyString(description) ? normalizeText(description) : null,
      size: isNonEmptyString(size) ? normalizeText(size) : null,
      color: isNonEmptyString(color) ? normalizeText(color) : null,
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
    return res.status(500).json({ ok: false, message: "Error creando prenda" });
  }
}

export async function updateGarment(req: Request, res: Response) {
  try {
    const id = req.params.id as string;

    const {
      garment_type_id,
      code,
      description,
      size,
      color,
      barcode,
      active,
      value,
    } = req.body;

    const garment = await Garment.findByPk(id);

    if (!garment) {
      return res.status(404).json({ ok: false, message: "Prenda no encontrada" });
    }

    if (!isNonEmptyString(garment_type_id) || !isNonEmptyString(code)) {
      return res.status(400).json({
        ok: false,
        message: "garment_type_id y code son obligatorios",
      });
    }

    /* const client = await Client.findByPk(client_id);
    if (!client) {
      return res.status(404).json({ ok: false, message: "Cliente no encontrado" });
    } */

    const garmentType = await GarmentType.findByPk(garment_type_id);
    if (!garmentType) {
      return res.status(404).json({ ok: false, message: "Tipo de prenda no encontrado" });
    }

    if (!isOptionalNonNegativeNumber(value)) {
      return res.status(400).json({
        ok: false,
        message: "El valor de la prenda no puede ser negativo",
      });
    }

    const normalizedCode = code.trim();
    const normalizedBarcode = isNonEmptyString(barcode) ? barcode.trim() : null;

    const existingCode = await Garment.findOne({
      where: {
        code: normalizedCode,
        id: { [Op.ne]: id },
      },
    });

    if (existingCode) {
      return res.status(409).json({
        ok: false,
        message: "Ya existe otra prenda con ese código para este cliente",
      });
    }

    if (normalizedBarcode) {
      const existingBarcode = await Garment.findOne({
        where: {
          barcode: normalizedBarcode,
          id: { [Op.ne]: id },
        },
      });

      if (existingBarcode) {
        return res.status(409).json({
          ok: false,
          message: "Ya existe otra prenda con ese código de barra",
        });
      }
    }

    await garment.update({
      garment_type_id,
      code: normalizedCode,
      description: isNonEmptyString(description) ? normalizeText(description) : null,
      size: isNonEmptyString(size) ? normalizeText(size) : null,
      color: isNonEmptyString(color) ? normalizeText(color) : null,
      barcode: normalizedBarcode,
      active: typeof active === "boolean" ? active : garment.active,
      value: Number(value || 0),
    });

    return res.json({
      ok: true,
      message: "Prenda actualizada correctamente",
      data: garment,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ ok: false, message: "Error actualizando prenda" });
  }
}

export async function deactivateGarment(req: Request, res: Response) {
  try {
    const id = req.params.id as string;

    const garment = await Garment.findByPk(id);

    if (!garment) {
      return res.status(404).json({ ok: false, message: "Prenda no encontrada" });
    }

    await garment.update({ active: false });

    return res.json({
      ok: true,
      message: "Prenda desactivada correctamente",
      data: garment,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ ok: false, message: "Error desactivando prenda" });
  }
}

import type { Request, Response } from "express";

import {
  DriverShift,
  DriverShiftCheck,
  Role,
  User,
  Vehicle,
  sequelize,
} from "../models/index.js";

import { DRIVER_CHECKLIST } from "../constant/driver-checklist.js";

import fs from "fs";
import path from "path";

import { generateDriverShiftPdf } from "../services/driver-shift-pdf.service.js";

import {
  getDriverShiftPhotos,
  getRelativeUploadPath,
  removeDriverShiftPhotos,
} from "../middlewares/driver-shift-upload.middleware.js";

type IncomingChecklistItem = {
  code: string;
  checked: boolean;
  observations?: string | null;
};

function buildTicketNumber() {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  const time = `${String(now.getHours()).padStart(2, "0")}${String(
    now.getMinutes(),
  ).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`;

  const random = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, "0");

  return `JOR-${year}${month}${day}-${time}-${random}`;
}

async function assertDriverRole(userId: string) {
  const user = await User.findByPk(userId, {
    include: [
      {
        model: Role,
        as: "role",
        attributes: ["id", "name", "name_display"],
      },
    ],
  });

  if (!user) {
    return {
      ok: false as const,
      status: 404,
      message: "Usuario no encontrado",
      user: null,
    };
  }

  const userJson = user.toJSON() as any;

  if (
    userJson.role?.name !== "transportista" &&
    userJson.role?.name !== "admin"
  ) {
    return {
      ok: false as const,
      status: 403,
      message: "El usuario no tiene permisos de transportista",
      user: null,
    };
  }

  return {
    ok: true as const,
    status: 200,
    message: "",
    user,
  };
}

function parseChecklist(value: unknown): IncomingChecklistItem[] | null {
  if (Array.isArray(value)) {
    return value as IncomingChecklistItem[];
  }

  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  try {
    const parsed = JSON.parse(value);

    if (!Array.isArray(parsed)) {
      return null;
    }

    return parsed as IncomingChecklistItem[];
  } catch {
    return null;
  }
}

export async function getDriverChecklist(req: Request, res: Response) {
  return res.json({
    ok: true,
    data: DRIVER_CHECKLIST,
  });
}

export async function getCurrentDriverShift(req: Request, res: Response) {
  try {
    if (!req.user?.id) {
      return res.status(401).json({
        ok: false,
        message: "Usuario no autenticado",
      });
    }

    const shift = await DriverShift.findOne({
      where: {
        user_id: req.user.id,
        status: "started",
      },

      include: [
        {
          model: Vehicle,
          as: "vehicle",
        },

        {
          model: DriverShiftCheck,
          as: "checks",
        },

        {
          model: User,
          as: "driver",
          attributes: ["id", "name", "email"],
        },
      ],

      order: [["started_at", "DESC"]],
    });

    return res.json({
      ok: true,
      data: shift,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      ok: false,
      message: "Error obteniendo jornada activa",
    });
  }
}

export async function getDriverShiftHistory(req: Request, res: Response) {
  try {
    if (!req.user?.id) {
      return res.status(401).json({
        ok: false,
        message: "Usuario no autenticado",
      });
    }

    const shifts = await DriverShift.findAll({
      where: {
        user_id: req.user.id,
      },

      include: [
        {
          model: Vehicle,
          as: "vehicle",
        },
      ],

      order: [["started_at", "DESC"]],
    });

    return res.json({
      ok: true,
      data: shifts,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      ok: false,
      message: "Error obteniendo historial de jornadas",
    });
  }
}

export async function startDriverShift(req: Request, res: Response) {
  const transaction = await sequelize.transaction();

  let transactionFinished = false;

  try {
    if (!req.user?.id) {
      await transaction.rollback();
      transactionFinished = true;

      removeDriverShiftPhotos(req);

      return res.status(401).json({
        ok: false,
        message: "Usuario no autenticado",
      });
    }

    const roleValidation = await assertDriverRole(req.user.id);

    if (!roleValidation.ok) {
      await transaction.rollback();
      transactionFinished = true;

      removeDriverShiftPhotos(req);

      return res.status(roleValidation.status).json({
        ok: false,
        message: roleValidation.message,
      });
    }

    const {
      vehicle_id,
      initial_mileage,
      observations,
      checklist: rawChecklist,
    } = req.body;

    /**
     * =====================================================
     * FOTOGRAFÍAS OBLIGATORIAS
     * =====================================================
     */

    const { driverPhoto, vehiclePhoto } = getDriverShiftPhotos(req);

    if (!driverPhoto || !vehiclePhoto) {
      await transaction.rollback();
      transactionFinished = true;

      removeDriverShiftPhotos(req);

      return res.status(400).json({
        ok: false,
        message:
          "Debe cargar una fotografía del conductor y una fotografía del vehículo para iniciar la jornada",
      });
    }

    if (typeof vehicle_id !== "string" || !vehicle_id.trim()) {
      await transaction.rollback();
      transactionFinished = true;

      removeDriverShiftPhotos(req);

      return res.status(400).json({
        ok: false,
        message: "vehicle_id es obligatorio",
      });
    }

    const parsedInitialMileage = Number(initial_mileage);

    if (!Number.isInteger(parsedInitialMileage) || parsedInitialMileage < 0) {
      await transaction.rollback();
      transactionFinished = true;

      removeDriverShiftPhotos(req);

      return res.status(400).json({
        ok: false,
        message: "El kilometraje inicial debe ser un entero mayor o igual a 0",
      });
    }

    /**
     * multipart/form-data entrega checklist como string.
     * Lo convertimos nuevamente a array.
     */
    const checklist = parseChecklist(rawChecklist);

    if (!checklist) {
      await transaction.rollback();
      transactionFinished = true;

      removeDriverShiftPhotos(req);

      return res.status(400).json({
        ok: false,
        message: "El checklist es obligatorio o tiene un formato inválido",
      });
    }

    const activeShift = await DriverShift.findOne({
      where: {
        user_id: req.user.id,
        status: "started",
      },

      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (activeShift) {
      await transaction.rollback();
      transactionFinished = true;

      removeDriverShiftPhotos(req);

      return res.status(409).json({
        ok: false,
        message: "Ya existe una jornada activa para este transportista",
      });
    }

    const vehicle = await Vehicle.findOne({
      where: {
        id: vehicle_id.trim(),
        active: true,
      },

      transaction,
    });

    if (!vehicle) {
      await transaction.rollback();
      transactionFinished = true;

      removeDriverShiftPhotos(req);

      return res.status(404).json({
        ok: false,
        message: "Vehículo no encontrado o inactivo",
      });
    }

    const checkMap = new Map<string, IncomingChecklistItem>();

    for (const item of checklist) {
      if (
        !item ||
        typeof item.code !== "string" ||
        typeof item.checked !== "boolean"
      ) {
        await transaction.rollback();
        transactionFinished = true;

        removeDriverShiftPhotos(req);

        return res.status(400).json({
          ok: false,
          message: "El checklist contiene elementos inválidos",
        });
      }

      checkMap.set(item.code, item);
    }

    /**
     * Todos los códigos definidos deben venir
     * en la solicitud.
     */
    for (const definition of DRIVER_CHECKLIST) {
      if (!checkMap.has(definition.code)) {
        await transaction.rollback();
        transactionFinished = true;

        removeDriverShiftPhotos(req);

        return res.status(400).json({
          ok: false,
          message: `Falta responder el checklist ${definition.code}`,
        });
      }
    }

    /**
     * Todos los checks obligatorios deben estar OK.
     */
    for (const definition of DRIVER_CHECKLIST) {
      const check = checkMap.get(definition.code);

      if (definition.required && check?.checked !== true) {
        await transaction.rollback();
        transactionFinished = true;

        removeDriverShiftPhotos(req);

        return res.status(400).json({
          ok: false,
          message: `No puede iniciar jornada: ${definition.label}`,
        });
      }
    }

    const driverPhotoPath = getRelativeUploadPath(driverPhoto);
    const vehiclePhotoPath = getRelativeUploadPath(vehiclePhoto);

    /**
     * =====================================================
     * CREACIÓN DE JORNADA
     * =====================================================
     */

    const shift = await DriverShift.create(
      {
        user_id: req.user.id,

        vehicle_id: vehicle_id.trim(),

        status: "started",

        started_at: new Date(),

        ended_at: null,

        initial_mileage: parsedInitialMileage,

        final_mileage: null,

        start_observations:
          typeof observations === "string" && observations.trim()
            ? observations.trim()
            : null,

        end_observations: null,

        ticket_number: buildTicketNumber(),

        ticket_pdf_path: null,

        driver_photo_path: driverPhotoPath,

        vehicle_photo_path: vehiclePhotoPath,
      },
      {
        transaction,
      },
    );

    /**
     * Guardamos snapshot histórico del checklist.
     */
    for (const definition of DRIVER_CHECKLIST) {
      const incoming = checkMap.get(definition.code);

      await DriverShiftCheck.create(
        {
          shift_id: shift.id,

          category: definition.category,

          code: definition.code,

          label: definition.label,

          checked: incoming?.checked === true,

          observations:
            typeof incoming?.observations === "string" &&
              incoming.observations.trim()
              ? incoming.observations.trim()
              : null,
        },
        {
          transaction,
        },
      );
    }

    await transaction.commit();
    transactionFinished = true;

    const createdShift = await DriverShift.findByPk(shift.id, {
      include: [
        {
          model: Vehicle,
          as: "vehicle",
        },

        {
          model: DriverShiftCheck,
          as: "checks",
        },

        {
          model: User,
          as: "driver",
          attributes: ["id", "name", "email"],
        },
      ],
    });

    if (!createdShift) {
      return res.status(500).json({
        ok: false,
        message: "La jornada fue creada, pero no pudo recuperarse",
      });
    }

    /**
     * La generación del PDF ocurre después del commit.
     * Un fallo del PDF no invalida una jornada ya iniciada.
     */
    try {
      const pdf = await generateDriverShiftPdf(createdShift as any);

      await createdShift.update({
        ticket_pdf_path: pdf.relativePath,
      });

      createdShift.ticket_pdf_path = pdf.relativePath;
    } catch (pdfError) {
      console.error("Error generando comprobante PDF:", pdfError);
    }

    return res.status(201).json({
      ok: true,
      message: "Jornada iniciada correctamente",
      data: createdShift,
    });
  } catch (error) {
    if (!transactionFinished) {
      try {
        await transaction.rollback();
      } catch (rollbackError) {
        console.error(
          "Error realizando rollback de inicio de jornada:",
          rollbackError,
        );
      }
    }

    /**
     * Si ocurrió un error antes del commit,
     * eliminamos las fotografías que Multer
     * ya hubiera escrito en disco.
     *
     * Después del commit las fotografías pertenecen
     * a una jornada válida y no deben eliminarse.
     */
    if (!transactionFinished) {
      removeDriverShiftPhotos(req);
    }

    console.error(error);

    return res.status(500).json({
      ok: false,
      message: "Error iniciando jornada",
    });
  }
}

export async function finishDriverShift(req: Request, res: Response) {
  const transaction = await sequelize.transaction();

  let transactionFinished = false;

  try {
    if (!req.user?.id) {
      await transaction.rollback();
      transactionFinished = true;

      return res.status(401).json({
        ok: false,
        message: "Usuario no autenticado",
      });
    }

    const { final_mileage, observations } = req.body;

    const parsedFinalMileage = Number(final_mileage);

    if (!Number.isInteger(parsedFinalMileage) || parsedFinalMileage < 0) {
      await transaction.rollback();
      transactionFinished = true;

      return res.status(400).json({
        ok: false,
        message: "El kilometraje final debe ser un entero mayor o igual a 0",
      });
    }

    const shift = await DriverShift.findOne({
      where: {
        user_id: req.user.id,
        status: "started",
      },

      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!shift) {
      await transaction.rollback();
      transactionFinished = true;

      return res.status(404).json({
        ok: false,
        message: "No existe una jornada activa",
      });
    }

    if (parsedFinalMileage < Number(shift.initial_mileage)) {
      await transaction.rollback();
      transactionFinished = true;

      return res.status(400).json({
        ok: false,
        message: "El kilometraje final no puede ser menor al inicial",
      });
    }

    await shift.update(
      {
        final_mileage: parsedFinalMileage,

        ended_at: new Date(),

        status: "completed",

        end_observations:
          typeof observations === "string" && observations.trim()
            ? observations.trim()
            : null,
      },
      {
        transaction,
      },
    );

    await transaction.commit();
    transactionFinished = true;

    const completedShift = await DriverShift.findByPk(shift.id, {
      include: [
        {
          model: Vehicle,
          as: "vehicle",
        },

        {
          model: DriverShiftCheck,
          as: "checks",
        },

        {
          model: User,
          as: "driver",
          attributes: ["id", "name", "email"],
        },
      ],
    });

    return res.json({
      ok: true,
      message: "Jornada finalizada correctamente",
      data: completedShift,
    });
  } catch (error) {
    if (!transactionFinished) {
      try {
        await transaction.rollback();
      } catch (rollbackError) {
        console.error(
          "Error realizando rollback de cierre de jornada:",
          rollbackError,
        );
      }
    }

    console.error(error);

    return res.status(500).json({
      ok: false,
      message: "Error finalizando jornada",
    });
  }
}

export async function downloadDriverShiftTicket(req: Request, res: Response) {
  try {
    if (!req.user?.id) {
      return res.status(401).json({
        ok: false,
        message: "Usuario no autenticado",
      });
    }

    const shiftId = req.params.id as string;

    const shift = await DriverShift.findByPk(shiftId, {
      include: [
        {
          model: Vehicle,
          as: "vehicle",
        },

        {
          model: DriverShiftCheck,
          as: "checks",
        },

        {
          model: User,
          as: "driver",
          attributes: ["id", "name", "email"],
        },
      ],
    });

    if (!shift) {
      return res.status(404).json({
        ok: false,
        message: "Jornada no encontrada",
      });
    }

    const role = (req.user as any)?.role?.name;

    if (role !== "admin" && shift.user_id !== req.user.id) {
      return res.status(403).json({
        ok: false,
        message: "No tienes permisos para descargar este comprobante",
      });
    }

    let pdfPath = shift.ticket_pdf_path
      ? path.resolve(process.cwd(), shift.ticket_pdf_path)
      : null;

    if (!pdfPath || !fs.existsSync(pdfPath)) {
      const pdf = await generateDriverShiftPdf(shift as any);

      await shift.update({
        ticket_pdf_path: pdf.relativePath,
      });

      pdfPath = pdf.outputPath;
    }

    return res.download(pdfPath, `${shift.ticket_number}.pdf`);
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      ok: false,
      message: "Error descargando comprobante de jornada",
    });
  }
}

export async function getAllDriverShifts(req: Request, res: Response) {
  try {
    const { user_id, vehicle_id, status } = req.query;

    const where: any = {};

    if (typeof user_id === "string" && user_id.trim()) {
      where.user_id = user_id.trim();
    }

    if (typeof vehicle_id === "string" && vehicle_id.trim()) {
      where.vehicle_id = vehicle_id.trim();
    }

    if (typeof status === "string" && status.trim()) {
      where.status = status.trim();
    }

    const shifts = await DriverShift.findAll({
      where,

      include: [
        {
          model: User,
          as: "driver",
          attributes: ["id", "name", "email"],
        },

        {
          model: Vehicle,
          as: "vehicle",
        },

        {
          model: DriverShiftCheck,
          as: "checks",
        },
      ],

      order: [["started_at", "DESC"]],
    });

    return res.json({
      ok: true,
      data: shifts,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      ok: false,
      message: "Error obteniendo jornadas de transportistas",
    });
  }
}

/**
 * =========================================================
 * FOTOGRAFÍAS DE JORNADA
 * =========================================================
 */

/**
 * Fotografía del conductor registrada
 * al inicio de una jornada.
 *
 * Acceso exclusivo para administrador.
 */
export async function getDriverShiftDriverPhoto(
  req: Request,
  res: Response,
) {
  try {
    const shiftId = req.params.id as string;

    const shift = await DriverShift.findByPk(shiftId);

    if (!shift) {
      return res.status(404).json({
        ok: false,
        message: "Jornada no encontrada",
      });
    }

    if (!shift.driver_photo_path) {
      return res.status(404).json({
        ok: false,
        message:
          "Esta jornada no tiene fotografía del conductor",
      });
    }

    const photoPath = path.resolve(
      process.cwd(),
      shift.driver_photo_path,
    );

    if (!fs.existsSync(photoPath)) {
      return res.status(404).json({
        ok: false,
        message:
          "La fotografía del conductor no existe en el almacenamiento",
      });
    }

    return res.sendFile(photoPath);
  } catch (error) {
    console.error(
      "Error obteniendo fotografía del conductor:",
      error,
    );

    return res.status(500).json({
      ok: false,
      message:
        "Error obteniendo fotografía del conductor",
    });
  }
}


/**
 * Fotografía del vehículo registrada
 * al inicio de una jornada.
 *
 * Acceso exclusivo para administrador.
 */
export async function getDriverShiftVehiclePhoto(
  req: Request,
  res: Response,
) {
  try {
    const shiftId = req.params.id as string;

    const shift = await DriverShift.findByPk(shiftId);

    if (!shift) {
      return res.status(404).json({
        ok: false,
        message: "Jornada no encontrada",
      });
    }

    if (!shift.vehicle_photo_path) {
      return res.status(404).json({
        ok: false,
        message:
          "Esta jornada no tiene fotografía del vehículo",
      });
    }

    const photoPath = path.resolve(
      process.cwd(),
      shift.vehicle_photo_path,
    );

    if (!fs.existsSync(photoPath)) {
      return res.status(404).json({
        ok: false,
        message:
          "La fotografía del vehículo no existe en el almacenamiento",
      });
    }

    return res.sendFile(photoPath);
  } catch (error) {
    console.error(
      "Error obteniendo fotografía del vehículo:",
      error,
    );

    return res.status(500).json({
      ok: false,
      message:
        "Error obteniendo fotografía del vehículo",
    });
  }
}
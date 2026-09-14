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

  try {
    if (!req.user?.id) {
      await transaction.rollback();

      return res.status(401).json({
        ok: false,
        message: "Usuario no autenticado",
      });
    }

    const roleValidation = await assertDriverRole(req.user.id);

    if (!roleValidation.ok) {
      await transaction.rollback();

      return res.status(roleValidation.status).json({
        ok: false,
        message: roleValidation.message,
      });
    }

    const { vehicle_id, initial_mileage, observations, checklist } = req.body;

    if (typeof vehicle_id !== "string" || !vehicle_id.trim()) {
      await transaction.rollback();

      return res.status(400).json({
        ok: false,
        message: "vehicle_id es obligatorio",
      });
    }

    const parsedInitialMileage = Number(initial_mileage);

    if (!Number.isInteger(parsedInitialMileage) || parsedInitialMileage < 0) {
      await transaction.rollback();

      return res.status(400).json({
        ok: false,
        message: "El kilometraje inicial debe ser un entero mayor o igual a 0",
      });
    }

    if (!Array.isArray(checklist)) {
      await transaction.rollback();

      return res.status(400).json({
        ok: false,
        message: "El checklist es obligatorio",
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

      return res.status(409).json({
        ok: false,
        message: "Ya existe una jornada activa para este transportista",
      });
    }

    const vehicle = await Vehicle.findOne({
      where: {
        id: vehicle_id,

        active: true,
      },

      transaction,
    });

    if (!vehicle) {
      await transaction.rollback();

      return res.status(404).json({
        ok: false,
        message: "Vehículo no encontrado o inactivo",
      });
    }

    const incomingChecks = checklist as IncomingChecklistItem[];

    const checkMap = new Map(incomingChecks.map((item) => [item.code, item]));

    /**
     * Comprobar que vienen todos
     * los códigos del checklist.
     */
    for (const definition of DRIVER_CHECKLIST) {
      if (!checkMap.has(definition.code)) {
        await transaction.rollback();

        return res.status(400).json({
          ok: false,
          message: `Falta responder el checklist ${definition.code}`,
        });
      }
    }

    /**
     * Los obligatorios deben estar OK.
     */
    for (const definition of DRIVER_CHECKLIST) {
      const check = checkMap.get(definition.code);

      if (definition.required && check?.checked !== true) {
        await transaction.rollback();

        return res.status(400).json({
          ok: false,
          message: `No puede iniciar jornada: ${definition.label}`,
        });
      }
    }

    const shift = await DriverShift.create(
      {
        user_id: req.user.id,

        vehicle_id,

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
      },
      {
        transaction,
      },
    );

    /**
     * Persistimos una copia textual
     * del checklist usado ese día.
     *
     * Aunque en el futuro cambie
     * DRIVER_CHECKLIST, esta jornada
     * conserva sus labels históricos.
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
    await transaction.rollback();

    console.error(error);

    return res.status(500).json({
      ok: false,
      message: "Error iniciando jornada",
    });
  }
}

export async function finishDriverShift(req: Request, res: Response) {
  const transaction = await sequelize.transaction();

  try {
    if (!req.user?.id) {
      await transaction.rollback();

      return res.status(401).json({
        ok: false,
        message: "Usuario no autenticado",
      });
    }

    const { final_mileage, observations } = req.body;

    const parsedFinalMileage = Number(final_mileage);

    if (!Number.isInteger(parsedFinalMileage) || parsedFinalMileage < 0) {
      await transaction.rollback();

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

      return res.status(404).json({
        ok: false,
        message: "No existe una jornada activa",
      });
    }

    if (parsedFinalMileage < Number(shift.initial_mileage)) {
      await transaction.rollback();

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
    await transaction.rollback();

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

    /**
     * Transportista solo puede
     * descargar sus propios tickets.
     *
     * Admin puede descargar cualquiera.
     */
    if (role !== "admin" && shift.user_id !== req.user.id) {
      return res.status(403).json({
        ok: false,
        message: "No tienes permisos para descargar este comprobante",
      });
    }

    /**
     * Si el PDF no existe,
     * intentamos regenerarlo.
     */
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

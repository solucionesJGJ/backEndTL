import type { Request } from "express";
import multer, { type FileFilterCallback } from "multer";
import fs from "fs";
import path from "path";
import crypto from "crypto";

const uploadDirectory = path.resolve(
    process.cwd(),
    "storage",
    "driver-shifts",
    "photos",
);

/**
 * La carpeta se crea automáticamente si no existe.
 */
fs.mkdirSync(uploadDirectory, {
    recursive: true,
});

const allowedMimeTypes = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
]);

function getExtension(file: Express.Multer.File): string {
    switch (file.mimetype) {
        case "image/jpeg":
            return ".jpg";

        case "image/png":
            return ".png";

        case "image/webp":
            return ".webp";

        default:
            return "";
    }
}

const storage = multer.diskStorage({
    destination: (_req, _file, callback) => {
        callback(null, uploadDirectory);
    },

    filename: (_req, file, callback) => {
        const extension = getExtension(file);

        const randomName = crypto.randomUUID();

        callback(null, `${Date.now()}-${randomName}${extension}`);
    },
});

function fileFilter(
    _req: Request,
    file: Express.Multer.File,
    callback: FileFilterCallback,
) {
    if (!allowedMimeTypes.has(file.mimetype)) {
        return callback(
            new Error(
                "Formato de imagen no permitido. Solo se aceptan JPEG, PNG o WEBP",
            ),
        );
    }

    callback(null, true);
}

export const driverShiftUpload = multer({
    storage,

    limits: {
        /**
         * 8 MB por fotografía.
         *
         * Es suficiente incluso para fotografías
         * tomadas directamente desde teléfonos.
         */
        fileSize: 8 * 1024 * 1024,

        /**
         * Exactamente esperamos dos archivos.
         */
        files: 2,
    },

    fileFilter,
});

export const driverShiftPhotoFields = driverShiftUpload.fields([
    {
        name: "driver_photo",
        maxCount: 1,
    },
    {
        name: "vehicle_photo",
        maxCount: 1,
    },
]);

/**
 * Obtiene los archivos procesados por Multer.
 */
export function getDriverShiftPhotos(req: Request): {
    driverPhoto?: Express.Multer.File;
    vehiclePhoto?: Express.Multer.File;
} {
    const files = req.files as
        | {
            [fieldname: string]: Express.Multer.File[];
        }
        | undefined;

    return {
        driverPhoto: files?.driver_photo?.[0],
        vehiclePhoto: files?.vehicle_photo?.[0],
    };
}

/**
 * Convierte la ruta absoluta de Multer en una ruta relativa
 * al proyecto para almacenar en PostgreSQL.
 *
 * Ejemplo:
 * storage/driver-shifts/photos/xxxxx.jpg
 */
export function getRelativeUploadPath(file: Express.Multer.File): string {
    return path
        .relative(process.cwd(), file.path)
        .replace(/\\/g, "/");
}

/**
 * Elimina una fotografía si la jornada no logra crearse.
 */
export function removeUploadedFile(
    file: Express.Multer.File | undefined,
): void {
    if (!file) {
        return;
    }

    try {
        if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
        }
    } catch (error) {
        console.error(
            `No fue posible eliminar archivo temporal ${file.path}:`,
            error,
        );
    }
}

export function removeDriverShiftPhotos(req: Request): void {
    const { driverPhoto, vehiclePhoto } = getDriverShiftPhotos(req);

    removeUploadedFile(driverPhoto);
    removeUploadedFile(vehiclePhoto);
}
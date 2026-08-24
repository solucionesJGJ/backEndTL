import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";

import type {
    DriverShift,
    DriverShiftCheck,
    User,
    Vehicle,
} from "../models/index.js";


type ShiftWithRelations = DriverShift & {
    driver?: User;
    vehicle?: Vehicle;
    checks?: DriverShiftCheck[];
};


function ensureDirectory(
    directoryPath: string,
) {
    if (!fs.existsSync(directoryPath)) {
        fs.mkdirSync(
            directoryPath,
            {
                recursive: true,
            },
        );
    }
}


function formatDate(
    value: Date | string,
) {
    return new Date(
        value,
    ).toLocaleString(
        "es-CL",
        {
            dateStyle: "short",
            timeStyle: "medium",
        },
    );
}


export async function generateDriverShiftPdf(
    shift: ShiftWithRelations,
) {
    const outputDirectory =
        path.resolve(
            process.cwd(),
            "storage",
            "driver-shifts",
        );


    ensureDirectory(
        outputDirectory,
    );


    const safeTicketNumber =
        shift.ticket_number
            .replace(
                /[^A-Za-z0-9_-]/g,
                "_",
            );


    const filename =
        `${safeTicketNumber}.pdf`;


    const outputPath =
        path.join(
            outputDirectory,
            filename,
        );


    const document =
        new PDFDocument({
            size: "A4",

            margins: {
                top: 50,
                bottom: 50,
                left: 50,
                right: 50,
            },
        });


    const stream =
        fs.createWriteStream(
            outputPath,
        );


    document.pipe(
        stream,
    );


    /**
     * CABECERA
     */

    document
        .fontSize(18)
        .text(
            "JGJ SOLUCIONES",
            {
                align: "center",
            },
        );


    document
        .moveDown(0.5)
        .fontSize(15)
        .text(
            "COMPROBANTE DE INICIO DE JORNADA",
            {
                align: "center",
            },
        );


    document.moveDown(1.5);


    /**
     * DATOS DEL TICKET
     */

    document
        .fontSize(11)
        .text(
            `Ticket: ${shift.ticket_number}`,
        );


    document.text(
        `Fecha de inicio: ${formatDate(
            shift.started_at,
        )}`,
    );


    document.text(
        `Estado: ${shift.status === "started"
            ? "Jornada activa"
            : shift.status === "completed"
                ? "Jornada finalizada"
                : "Jornada cancelada"
        }`,
    );


    document.moveDown();


    /**
     * TRANSPORTISTA
     */

    document
        .fontSize(13)
        .text(
            "Transportista",
            {
                underline: true,
            },
        );


    document
        .moveDown(0.3)
        .fontSize(11)
        .text(
            `Nombre: ${shift.driver?.name
            || "-"
            }`,
        );


    document.text(
        `Correo: ${shift.driver?.email
        || "-"
        }`,
    );


    document.moveDown();


    /**
     * VEHÍCULO
     */

    document
        .fontSize(13)
        .text(
            "Vehículo",
            {
                underline: true,
            },
        );


    document
        .moveDown(0.3)
        .fontSize(11)
        .text(
            `Patente: ${shift.vehicle?.plate
            || "-"
            }`,
        );


    document.text(
        `Marca: ${shift.vehicle?.brand
        || "-"
        }`,
    );


    document.text(
        `Modelo: ${shift.vehicle?.model
        || "-"
        }`,
    );


    document.text(
        `Año: ${shift.vehicle?.year
        || "-"
        }`,
    );


    document.text(
        `Kilometraje inicial: ${Number(
            shift.initial_mileage,
        ).toLocaleString(
            "es-CL",
        )} km`,
    );


    document.moveDown();


    /**
     * CHECKLIST
     */

    document
        .fontSize(13)
        .text(
            "Checklist de inicio",
            {
                underline: true,
            },
        );


    document.moveDown(0.5);


    const vehicleChecks =
        shift.checks
            ?.filter(
                (check) =>
                    check.category ===
                    "vehicle",
            )
        || [];


    const driverChecks =
        shift.checks
            ?.filter(
                (check) =>
                    check.category ===
                    "driver",
            )
        || [];


    if (
        vehicleChecks.length >
        0
    ) {
        document
            .fontSize(11)
            .text(
                "Condiciones del vehículo",
                {
                    underline: true,
                },
            );


        document.moveDown(0.3);


        for (
            const check
            of vehicleChecks
        ) {
            document.text(
                `${check.checked ? "[OK]" : "[NO]"} ${check.label}`,
            );


            if (
                check.observations
            ) {
                document
                    .fontSize(9)
                    .text(
                        `Observación: ${check.observations}`,
                        {
                            indent: 15,
                        },
                    )
                    .fontSize(11);
            }
        }


        document.moveDown();
    }


    if (
        driverChecks.length >
        0
    ) {
        document
            .fontSize(11)
            .text(
                "Condiciones del conductor",
                {
                    underline: true,
                },
            );


        document.moveDown(0.3);


        for (
            const check
            of driverChecks
        ) {
            document.text(
                `${check.checked ? "[OK]" : "[NO]"} ${check.label}`,
            );


            if (
                check.observations
            ) {
                document
                    .fontSize(9)
                    .text(
                        `Observación: ${check.observations}`,
                        {
                            indent: 15,
                        },
                    )
                    .fontSize(11);
            }
        }
    }


    document.moveDown();


    /**
     * OBSERVACIONES
     */

    document
        .fontSize(13)
        .text(
            "Observaciones",
            {
                underline: true,
            },
        );


    document
        .moveDown(0.3)
        .fontSize(11)
        .text(
            shift.start_observations
            || "Sin observaciones.",
        );


    document.moveDown(2);


    document
        .fontSize(9)
        .text(
            "Documento generado automáticamente por TL.",
            {
                align: "center",
            },
        );


    document.end();


    await new Promise<void>(
        (
            resolve,
            reject,
        ) => {

            stream.on(
                "finish",
                () => resolve(),
            );

            stream.on(
                "error",
                reject,
            );
        },
    );


    return {
        outputPath,
        relativePath:
            path.relative(
                process.cwd(),
                outputPath,
            ),
        filename,
    };
}
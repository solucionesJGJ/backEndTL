import axios from "axios";

import type { Request, Response } from "express";

import { DispatchGuide } from "../models/index.js";

export async function getDispatchGuidePdfController(
  req: Request,
  res: Response,
) {
  try {
    const id = typeof req.params.id === "string" ? req.params.id.trim() : "";

    if (!id) {
      return res.status(400).json({
        ok: false,
        message: "Id de guía inválido",
      });
    }

    const guide = await DispatchGuide.findByPk(id);

    if (!guide) {
      return res.status(404).json({
        ok: false,
        message: "Guía de despacho no encontrada",
      });
    }

    if (!guide.engine_document_id) {
      return res.status(400).json({
        ok: false,
        message: "La guía todavía no tiene documento asociado en el Motor",
      });
    }

    const engineUrl = process.env.BILLING_ENGINE_URL?.trim().replace(
      /\/+$/,
      "",
    );

    const engineApiKey = process.env.BILLING_ENGINE_API_KEY?.trim();

    if (!engineUrl || !engineApiKey) {
      throw new Error("Configuración del Motor de facturación incompleta");
    }

    /**
     * El Motor ya posee el endpoint genérico
     * de PDF para BillingDocument.
     *
     * El DTE52 también es BillingDocument,
     * por lo que reutilizamos exactamente
     * la misma ruta.
     */
    const engineResponse = await axios.get(
      `${engineUrl}/api/billing/documents/${guide.engine_document_id}/pdf`,
      {
        headers: {
          "x-api-key": engineApiKey,
        },

        responseType: "arraybuffer",
      },
    );

    res.setHeader("Content-Type", "application/pdf");

    const disposition = engineResponse.headers["content-disposition"];

    res.setHeader(
      "Content-Disposition",
      typeof disposition === "string"
        ? disposition
        : `inline; filename="guia-despacho-${guide.engine_folio ?? guide.id}.pdf"`,
    );

    return res.send(Buffer.from(engineResponse.data));
  } catch (error: any) {
    console.error(
      "Error obteniendo PDF de guía desde Motor:",
      error?.response?.data || error,
    );

    const status = Number(error?.response?.status) || 500;

    return res.status(status).json({
      ok: false,

      message:
        error?.response?.data?.message ||
        error?.message ||
        "No fue posible obtener el PDF de la guía de despacho",
    });
  }
}

type BillingEngineItem = {
  description: string;
  quantity: number;
  unitPrice: number;
  discountPercentage?: number;
};

type BillingEngineReceiver = {
  rut: string;
  razonSocial: string;
  giro?: string;
  address?: string;
  comuna?: string;
  ciudad?: string;
};

/**
 * =========================================================
 * DTE 52 - DATOS DE DESPACHO
 * =========================================================
 */
export type BillingEngineDispatch = {
  /**
   * Indicador de traslado SII.
   *
   * Motor actual:
   * 1..9 válidos a nivel contrato.
   *
   * La implementación actual de TL utilizará
   * guías NO VENTA.
   */
  transferIndicator: number;

  /**
   * Tipo de despacho:
   *
   * 1 = despacho por cuenta del emisor
   * 2 = despacho por cuenta del receptor
   * 3 = despacho por terceros
   */
  dispatchType?: number;

  vehiclePlate?: string;
  carrierRut?: string;

  /**
   * Aunque el tipo del Motor los considera
   * opcionales en entrada, el builder XML
   * actual los requiere para Transporte.
   */
  driverRut: string;
  driverName: string;

  destinationAddress: string;
  destinationCommune: string;
  destinationCity?: string;

  /**
   * Formatos esperados por Motor:
   *
   * departureDate:
   * YYYY-MM-DD
   *
   * departureTime:
   * HH:mm o HH:mm:ss
   *
   * arrivalDate:
   * YYYY-MM-DD
   */
  departureDate: string;
  departureTime: string;
  arrivalDate: string;
};

export type BillingEngineInvoicePayload = {
  externalId: string;

  documentType: number;

  receiver: BillingEngineReceiver;

  items: BillingEngineItem[];

  /**
   * Sólo debe informarse para DTE 52.
   */
  dispatch?: BillingEngineDispatch;
};

type EngineCreateResponse = {
  ok: boolean;
  message: string;

  data?: {
    id: string;
    document_type: number;
    folio: number;
    status: string;
    net_amount: number | string;
    tax_amount: number | string;
    total_amount: number | string;
  };
};

type EngineProcessResponse = {
  ok: boolean;
  message: string;

  data?: {
    document_id: string;
    document_type: number;
    folio: number;
    status: string;

    net_amount: number;
    tax_amount: number;
    total_amount: number;

    sii: {
      mode: string;

      track_id: string | null;

      status: string;
    };
  };
};

/**
 * =========================================================
 * CONFIGURACIÓN MOTOR
 * =========================================================
 */
function getEngineConfig() {
  const baseUrl = process.env.BILLING_ENGINE_URL?.trim().replace(/\/+$/, "");

  const apiKey = process.env.BILLING_ENGINE_API_KEY?.trim();

  if (!baseUrl) {
    throw new Error("BILLING_ENGINE_URL no está configurada");
  }

  if (!apiKey) {
    throw new Error("BILLING_ENGINE_API_KEY no está configurada");
  }

  return {
    baseUrl,
    apiKey,
  };
}

/**
 * =========================================================
 * REQUEST GENÉRICO AL MOTOR
 * =========================================================
 */
async function engineRequest<T>(
  path: string,
  options: RequestInit,
): Promise<T> {
  const { baseUrl, apiKey } = getEngineConfig();

  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, 30000);

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      ...options,

      headers: {
        "Content-Type": "application/json",

        "x-api-key": apiKey,

        ...(options.headers || {}),
      },

      signal: controller.signal,
    });

    const rawText = await response.text();

    let responseBody: any;

    try {
      responseBody = rawText ? JSON.parse(rawText) : null;
    } catch {
      responseBody = {
        ok: false,

        message: rawText || "Respuesta inválida del Motor",
      };
    }

    if (!response.ok) {
      /**
       * El Motor puede entregar errores
       * de validación específicos.
       */
      const errors = Array.isArray(responseBody?.errors)
        ? responseBody.errors.join("; ")
        : null;

      const message =
        errors ||
        responseBody?.message ||
        `Motor respondió HTTP ${response.status}`;

      throw new Error(message);
    }

    return responseBody as T;
  } catch (error: any) {
    if (error?.name === "AbortError") {
      throw new Error("Timeout comunicando con el Motor de Facturación");
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * =========================================================
 * CREAR DOCUMENTO EN MOTOR
 * =========================================================
 *
 * Sirve tanto para DTE 33 como para DTE 52.
 *
 * documentType determinará el comportamiento
 * dentro del Motor.
 */
export async function createEngineInvoice(
  payload: BillingEngineInvoicePayload,
) {
  const response = await engineRequest<EngineCreateResponse>(
    "/api/billing/invoice",
    {
      method: "POST",

      body: JSON.stringify(payload),
    },
  );

  if (!response.ok || !response.data?.id) {
    throw new Error(response.message || "El Motor no creó el documento");
  }

  return response.data;
}

/**
 * =========================================================
 * PROCESAR DOCUMENTO EN MOTOR
 * =========================================================
 *
 * Motor:
 *
 * XML
 * firma
 * EnvioDTE
 * firma sobre
 * SII / mock
 * consulta estado
 */
export async function processEngineInvoice(engineDocumentId: string) {
  if (!engineDocumentId?.trim()) {
    throw new Error("engineDocumentId es obligatorio");
  }

  const response = await engineRequest<EngineProcessResponse>(
    `/api/billing/documents/${engineDocumentId}/process`,
    {
      method: "POST",
    },
  );

  if (!response.ok || !response.data) {
    throw new Error(
      response.message || "El Motor no pudo procesar el documento",
    );
  }

  return response.data;
}

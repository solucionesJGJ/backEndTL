export type EconomicActivitySeed = {
    code: string;
    description: string;
    vat_affected: string | null;
    tax_category: string | null;
    internet_available: string | null;
};

export const economicActivities: EconomicActivitySeed[] = [
    {
        code: "960100",
        description:
            "LAVADO Y LIMPIEZA, INCLUIDA LA LIMPIEZA EN SECO, DE PRODUCTOS TEXTILES Y DE PIEL",
        vat_affected: "SI",
        tax_category: "1",
        internet_available: "SI",
    },
    {
        code: "682000",
        description:
            "ACTIVIDADES INMOBILIARIAS REALIZADAS A CAMBIO DE UNA RETRIBUCIÓN O POR CONTRATA",
        vat_affected: "SI",
        tax_category: "1",
        internet_available: "SI",
    },
    {
        code: "681011",
        description:
            "ALQUILER DE BIENES INMUEBLES AMOBLADOS O CON EQUIPOS Y MAQUINARIAS",
        vat_affected: "SI",
        tax_category: "1",
        internet_available: "SI",
    },
    {
        code: "469000",
        description:
            "VENTA AL POR MAYOR NO ESPECIALIZADA",
        vat_affected: "SI",
        tax_category: "1",
        internet_available: "NO",
    },
    {
        code: "562100",
        description:
            "SUMINISTRO DE COMIDAS POR ENCARGO (SERVICIOS DE BANQUETERÍA)",
        vat_affected: "SI",
        tax_category: "1",
        internet_available: "SI",
    },
    {
        code: "869091",
        description:
            "OTROS SERVICIOS DE ATENCIÓN DE LA SALUD HUMANA PRESTADOS POR EMPRESAS",
        vat_affected: "SI",
        tax_category: "1",
        internet_available: "SI",
    },
    {
        code: "561000",
        description:
            "ACTIVIDADES DE RESTAURANTES Y DE SERVICIO MÓVIL DE COMIDAS",
        vat_affected: "SI",
        tax_category: "1",
        internet_available: "SI",
    },
];
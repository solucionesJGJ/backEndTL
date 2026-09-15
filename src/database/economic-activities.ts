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
];
declare global {
    namespace Express {
        interface Request {
            user?: {
                id: string;
                name: string;
                email: string;
                role_id: string;
                client_id: string | null;
                active: boolean;
                role?: {
                    id: string;
                    name: string;
                    nameDisplay: string;
                };
                client?: {
                    id: string;
                    name: string;
                    rut: string | null;
                } | null;
            };
        }
    }
}

export { };
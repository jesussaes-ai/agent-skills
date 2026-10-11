import { z } from "zod";

// Sin esto, Zod prueba `Function("")` al validar y la CSP (sin 'unsafe-eval') lo reporta como violación.
z.config({ jitless: true });

export { z };

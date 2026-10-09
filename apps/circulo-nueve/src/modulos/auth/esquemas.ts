import { z } from "zod";
import { PATRON_USUARIO, normalizarUsuario } from "./usuarios";

export const ROLES_ASIGNABLES = ["consultor", "cliente", "admin"] as const;

/** Paquetes de permisos que la administración asigna a cada asistente. */
export const PAQUETES_PERMISOS = {
  expedientes_propios: {
    texto: "Crear y gestionar sus propios expedientes (separados de los de los demás)",
    permisos: [
      ["listar", "propio"],
      ["abrir_descargar", "propio"],
      ["cargar", "propio"],
      ["modificar", "propio"],
      ["borrar", "propio"],
    ],
  },
  compartir_propios: { texto: "Compartir sus propios expedientes (vincular la cuenta de un cliente)", permisos: [["compartir", "propio"]] },
  ver_todos: { texto: "Ver y descargar todos los expedientes (solo lectura)", permisos: [["listar", "global"], ["abrir_descargar", "global"]] },
  biblioteca: { texto: "Administrar la biblioteca de fuentes", permisos: [["admin_fuentes", "global"]] },
} as const satisfies Record<string, { texto: string; permisos: readonly (readonly [string, "propio" | "global"])[] }>;
export type PaquetePermisos = keyof typeof PAQUETES_PERMISOS;
export const NOMBRES_PAQUETES = Object.keys(PAQUETES_PERMISOS) as PaquetePermisos[];

export const usuario = z
  .string()
  .transform(normalizarUsuario)
  .refine((v) => PATRON_USUARIO.test(v), "Usuario de 3 a 32 caracteres: empieza con letra; solo letras sin acento, números, punto, guion o guion bajo.");
export const ESTADOS_CUENTA = ["activo", "suspendido", "revocado"] as const;

const nombre = z.string().trim().min(1, "Escribe un nombre.").max(120, "El nombre es demasiado largo.");

export const contrasena = z
  .string()
  .min(10, "La contraseña debe tener al menos 10 caracteres.")
  .max(72, "La contraseña no puede superar 72 caracteres.")
  .refine((v) => /[A-Za-zÀ-ÿ]/.test(v) && /\d/.test(v), "La contraseña debe combinar letras y números.");

export const esquemaAlta = z
  .object({
    clave: z.string().min(1, "Escribe la clave de alta.").max(512),
    usuario,
    contrasena,
    confirmacion: z.string(),
  })
  .refine((d) => d.contrasena === d.confirmacion, { path: ["confirmacion"], message: "Las contraseñas no coinciden." });

export const esquemaEntrar = z.object({
  usuario: z.string().transform(normalizarUsuario).pipe(z.string().min(1, "Escribe tu usuario.").max(64)),
  contrasena: z.string().min(1, "Escribe tu contraseña.").max(72),
});

export const esquemaNuevaContrasena = z
  .object({ contrasena, confirmacion: z.string() })
  .refine((d) => d.contrasena === d.confirmacion, { path: ["confirmacion"], message: "Las contraseñas no coinciden." });

export const esquemaCodigoMfa = z.object({
  codigo: z.string().trim().regex(/^\d{6}$/, "El código tiene 6 dígitos."),
  factorId: z.string().uuid().optional(),
});

const contrasenaInicial = z.union([z.literal(""), contrasena]).transform((v) => v || null);

export const esquemaCrearCuenta = z.object({
  nombre,
  usuario,
  rol: z.enum(ROLES_ASIGNABLES),
  contrasena: contrasenaInicial,
  forzarCambio: z.enum(["on"]).optional(),
  paquetes: z.array(z.enum(NOMBRES_PAQUETES as [PaquetePermisos, ...PaquetePermisos[]])).default([]),
});

export const esquemaRestablecer = z.object({
  usuarioId: z.string().uuid(),
  contrasena: contrasenaInicial,
  forzarCambio: z.enum(["on"]).optional(),
});

export const esquemaPaquetes = z.object({
  usuarioId: z.string().uuid(),
  paquetes: z.array(z.enum(NOMBRES_PAQUETES as [PaquetePermisos, ...PaquetePermisos[]])).default([]),
});

export const esquemaEstado = z.object({ usuarioId: z.string().uuid(), estado: z.enum(ESTADOS_CUENTA) });

export const esquemaRol = z.object({
  usuarioId: z.string().uuid(),
  rol: z.enum(ROLES_ASIGNABLES),
  operacion: z.enum(["asignar", "retirar"]),
});

export type EstadoFormulario = {
  ok?: boolean;
  mensaje?: string;
  errores?: Record<string, string>;
  /** Lo que se envió, para volver a mostrarlo si hubo error (React vacía el formulario). */
  valores?: Record<string, string>;
  /** Enlace de un solo uso generado para compartirlo sin correo (se muestra una vez). */
  enlace?: string;
  /** Contraseña inicial generada por el servidor (se muestra una sola vez). */
  contrasena?: string;
};

export function erroresDe(error: z.ZodError): Record<string, string> {
  const errores: Record<string, string> = {};
  for (const issue of error.issues) {
    const campo = String(issue.path[0] ?? "formulario");
    errores[campo] ??= issue.message;
  }
  return errores;
}

export function datosDe(form: FormData): Record<string, string> {
  return Object.fromEntries([...form.entries()].map(([k, v]) => [k, typeof v === "string" ? v : ""]));
}

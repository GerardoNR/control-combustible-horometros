import { z } from 'zod';
const nombreUsuario = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, 'Usa al menos 3 caracteres.')
  .max(40, 'Máximo 40 caracteres.')
  .regex(/^[a-z0-9._-]+$/, 'Usa letras sin acentos, números, punto, guion o guion bajo.');
export const esquemaAcceso = z.object({
  nombreUsuario: z.string().trim().min(1, 'Ingresa tu usuario.'),
  contrasena: z.string().min(1, 'Ingresa tu contraseña.').max(128, 'Máximo 128 caracteres.'),
});
export const esquemaContrasena = z
  .string()
  .min(10, 'Usa al menos 10 caracteres.')
  .max(128, 'Máximo 128 caracteres.')
  .regex(/[A-Z]/, 'Incluye una mayúscula.')
  .regex(/[a-z]/, 'Incluye una minúscula.')
  .regex(/[0-9]/, 'Incluye un número.')
  .regex(/[^A-Za-z0-9\s]/, 'Incluye un símbolo.');
const rol = z.enum(['INVITADO', 'CAPTURISTA', 'ADMINISTRADOR']);
const permisos = z.array(z.enum(['maquinarias', 'horometros', 'combustible', 'control-diario']));
export const esquemaCuenta = z.object({
  nombre: z
    .string()
    .trim()
    .min(3, 'Ingresa el nombre completo.')
    .max(120, 'Máximo 120 caracteres.'),
  nombreUsuario,
  contrasena: z.union([z.literal(''), esquemaContrasena]),
  rol,
  activo: z.boolean(),
  permisos,
});
export const esquemaCuentasGuardadas = z.array(
  z.object({
    id: z.string(),
    nombre: z.string(),
    nombreUsuario,
    rol,
    iniciales: z.string(),
    activo: z.boolean(),
    permisos,
    credencial: z.object({
      sal: z.string().regex(/^[a-f0-9]{32}$/),
      derivacion: z.string().regex(/^[a-f0-9]{64}$/),
      iteraciones: z.number().int().min(100000).max(1000000),
    }),
  }),
);

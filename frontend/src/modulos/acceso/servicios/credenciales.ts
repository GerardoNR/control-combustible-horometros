import type { Credencial } from '../tipos/usuario';
const aHexadecimal = (datos: Uint8Array) =>
  Array.from(datos, (valor) => valor.toString(16).padStart(2, '0')).join('');
async function derivar(contrasena: string, sal: string, iteraciones: number) {
  if (!crypto.subtle)
    throw new Error('El acceso de demostración necesita HTTPS o localhost para usar Web Crypto.');
  const clave = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(contrasena),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bytesSal = Uint8Array.from(sal.match(/.{2}/g) ?? [], (valor) => parseInt(valor, 16));
  const resultado = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: bytesSal, iterations: iteraciones, hash: 'SHA-256' },
    clave,
    256,
  );
  return aHexadecimal(new Uint8Array(resultado));
}
export async function crearCredencial(contrasena: string): Promise<Credencial> {
  const sal = aHexadecimal(crypto.getRandomValues(new Uint8Array(16)));
  const iteraciones = 120000;
  return { sal, iteraciones, derivacion: await derivar(contrasena, sal, iteraciones) };
}
export async function verificarCredencial(contrasena: string, credencial: Credencial) {
  return (
    (await derivar(contrasena, credencial.sal, credencial.iteraciones)) === credencial.derivacion
  );
}

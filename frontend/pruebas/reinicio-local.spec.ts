import { test, expect, chromium } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { crearMuestraFicticia } from './datos/operaciones-completas';
import { confirmarCambios, navegar } from './ayudantes';

async function detener(servidor: ChildProcess | undefined) {
  if (!servidor || servidor.exitCode !== null || servidor.signalCode !== null) return;
  const salida = once(servidor, 'exit');
  servidor.kill('SIGTERM');
  await salida;
}

test('no limpia datos heredados al iniciar y conserva nuevas capturas al reiniciar Vite', async ({ browserName }, informacion) => {
  expect(browserName).toBe('chromium');
  test.setTimeout(90000);
  const puerto = 5180 + ['escritorio', 'tablet', 'movil'].indexOf(informacion.project.name);
  const direccion = `http://127.0.0.1:${puerto}`;
  const perfil = await mkdtemp(join(tmpdir(), 'control-maquinaria-perfil-prueba-'));
  let servidor: ChildProcess | undefined;
  let contexto: Awaited<ReturnType<typeof chromium.launchPersistentContext>> | undefined;
  async function arrancar() {
    servidor = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(puerto), '--strictPort'], { stdio: 'ignore' });
    await expect.poll(async () => {
      try { return (await fetch(direccion)).status; } catch { return 0; }
    }, { timeout: 15000 }).toBe(200);
    contexto = await chromium.launchPersistentContext(perfil, {
      executablePath: process.env.CHROME_BIN || undefined,
      args: ['--no-sandbox'],
      viewport: informacion.project.name === 'escritorio' ? { width: 1280, height: 720 } : { width: 390, height: 844 },
      isMobile: informacion.project.name !== 'escritorio',
      hasTouch: informacion.project.name !== 'escritorio',
    });
    return contexto.pages()[0];
  }
  async function entrar(pagina: import('@playwright/test').Page, usuario: string, contrasena: string) {
    await expect(pagina.getByRole('region', { name: 'Inicio de sesión' })).toBeVisible();
    await pagina.getByLabel('Usuario', { exact: true }).fill(usuario);
    await pagina.getByLabel('Contraseña', { exact: true }).fill(contrasena);
    await pagina.getByRole('button', { name: 'Iniciar sesión', exact: true }).click();
    await expect(pagina.locator('#selector-usuario')).toBeVisible();
  }
  try {
    let pagina = await arrancar();
    await contexto!.addInitScript((base) => {
      if (!localStorage.getItem('marimba.datos.v1')) {
        localStorage.setItem('marimba.datos.v0', JSON.stringify(base));
        sessionStorage.setItem('marimba.horometros.v1', JSON.stringify(base.horometros));
      }
    }, crearMuestraFicticia());
    await pagina.goto(`${direccion}/acceso`);
    await entrar(pagina, 'admin1', '123456781');
    for (const pantalla of ['Maquinarias', 'Horómetros', 'Combustible', 'Control Diario']) {
      await navegar(pagina, informacion, pantalla);
      await expect(pagina.getByText('No hay registros para mostrar')).toBeVisible();
    }
    expect(await pagina.evaluate(() => localStorage.getItem('marimba.datos.v0'))).not.toBeNull();
    expect(await pagina.evaluate(() => sessionStorage.getItem('marimba.horometros.v1'))).not.toBeNull();
    await expect(pagina.getByLabel('Filtrar por maquinaria')).toHaveValue('');
    await expect(pagina.getByLabel('Filtrar por operador')).toHaveValue('');
    await navegar(pagina, informacion, 'Maquinarias');
    await pagina.getByRole('button', { name: 'Registrar maquinaria', exact: true }).click();
    await pagina.getByLabel('Número económico *').fill('NUEVA-001');
    await pagina.getByLabel('Placas *').fill('NL-PRUEBA');
    await pagina.getByLabel('Tipo de maquinaria *').fill('Excavadora');
    await pagina.getByLabel('Marca *').fill('Marca de prueba');
    await pagina.getByLabel('Modelo *', { exact: true }).fill('Modelo temporal');
    await pagina.getByLabel('Horómetro base (h) *').fill('100');
    await confirmarCambios(pagina);
    await pagina.getByRole('button', { name: 'Guardar registro', exact: true }).click();
    await expect(pagina.getByRole('dialog')).toHaveCount(0);
    await expect(pagina.locator('tbody')).toContainText('NUEVA-001');
    const antes = await pagina.evaluate(() => ({
      datos: localStorage.getItem('marimba.datos.v1'),
      cuentas: localStorage.getItem('marimba.usuarios.desarrollo.v1'),
      migracion: localStorage.getItem('marimba.migraciones.limpieza-operativa.v1'),
    }));
    await pagina.reload();
    await expect(pagina.locator('tbody')).toContainText('NUEVA-001');
    await pagina.locator('#selector-usuario').click();
    await pagina.getByRole('button', { name: 'Cerrar sesión', exact: true }).click();
    await entrar(pagina, 'admin2', '123456782');
    await expect(pagina.locator('tbody')).toContainText('NUEVA-001');
    await pagina.locator('#selector-usuario').click();
    await pagina.getByRole('button', { name: 'Cerrar sesión', exact: true }).click();
    await contexto!.close();
    contexto = undefined;
    await detener(servidor);
    servidor = undefined;
    pagina = await arrancar();
    await pagina.goto(`${direccion}/acceso`);
    await entrar(pagina, 'admin1', '123456781');
    await expect(pagina.locator('tbody tr')).toHaveCount(1);
    await expect(pagina.locator('tbody')).toContainText('NUEVA-001');
    expect(await pagina.evaluate(() => ({
      datos: localStorage.getItem('marimba.datos.v1'),
      cuentas: localStorage.getItem('marimba.usuarios.desarrollo.v1'),
      migracion: localStorage.getItem('marimba.migraciones.limpieza-operativa.v1'),
    }))).toEqual(antes);
  } finally {
    await contexto?.close();
    await detener(servidor);
    await rm(perfil, { recursive: true, force: true });
  }
});

import { test, expect } from '@playwright/test';
import { iniciarSesionConMuestraCompleta } from './ayudantes';
import type { BaseDatos } from '../src/compartido/tipos/datos';

test('conserva los cuatro colores al enfocar, presionar y consultar las alertas', async ({ page }) => {
  await page.goto('/control-diario');
  await iniciarSesionConMuestraCompleta(page);
  for (const [nivel, maximo, advertencia, fondo, texto] of [
    ['Normal', 100, 110, 'rgb(231, 244, 234)', 'rgb(22, 101, 52)'],
    ['Revisar', 1, 100, 'rgb(255, 246, 218)', 'rgb(133, 77, 14)'],
    ['Crítica', 1, 2, 'rgb(252, 232, 232)', 'rgb(153, 27, 27)'],
    ['Sin evaluar', null, null, 'rgb(255, 241, 242)', 'rgb(159, 18, 57)'],
  ] as const) {
    await page.evaluate(({ maximo, advertencia }) => {
      const base = JSON.parse(localStorage.getItem('marimba.datos.v1')!) as BaseDatos;
      const maquinaria = base.maquinarias[0];
      delete maquinaria.consumoMinimoEsperado;
      delete maquinaria.horasMinimasDiarias;
      if (maximo === null) {
        delete maquinaria.consumoNormalMaximo;
        delete maquinaria.consumoAdvertenciaMaximo;
      } else {
        maquinaria.consumoNormalMaximo = maximo;
        maquinaria.consumoAdvertenciaMaximo = advertencia!;
      }
      localStorage.setItem('marimba.datos.v1', JSON.stringify(base));
    }, { maximo, advertencia });
    await page.reload();
    await page.getByLabel('Filtrar por maquinaria').selectOption('prueba-maq-01');
    const boton = page.getByRole('button', { name: new RegExp(`Consultar alerta ${nivel}`) }).first();
    const etiqueta = boton.locator('.badge');
    await expect(etiqueta).toHaveCSS('background-color', fondo);
    await expect(etiqueta).toHaveCSS('color', texto);
    await expect(etiqueta).not.toHaveClass(/bg-primary/);
    await boton.focus();
    await expect(etiqueta).toHaveCSS('background-color', fondo);
    await boton.dispatchEvent('mousedown');
    await expect(etiqueta).toHaveCSS('background-color', fondo);
    await boton.click();
    await expect(page.getByRole('dialog').locator('.badge')).toHaveCSS('background-color', fondo);
    await page.getByRole('dialog').getByRole('button', { name: 'Cerrar', exact: true }).click();
    await expect(etiqueta).toHaveCSS('background-color', fondo);
  }
});

import { test, expect } from '@playwright/test';
import { iniciarSesion, navegar } from './ayudantes';
test('mantiene acciones separadas, horizontales, accesibles y con colores por operación', async ({
  page,
}, informacion) => {
  await page.goto('/maquinarias');
  await iniciarSesion(page);
  const operaciones = [
    { nombre: 'Consultar registro', color: 'rgb(29, 78, 216)' },
    { nombre: 'Editar registro', color: 'rgb(180, 83, 9)' },
    { nombre: 'Eliminar registro', color: 'rgb(185, 28, 28)' },
  ];
  for (const nombre of ['Maquinarias', 'Horómetros', 'Combustible']) {
    await navegar(page, informacion, nombre);
    const region = page.getByRole('region', {
      name: 'Tabla de registros, desplazable horizontalmente',
    });
    await expect(region.getByRole('columnheader').last()).toHaveText('Acciones');
    const fila = region.locator('tbody tr').first();
    const celda = fila.locator('td').last();
    await expect(celda.getByRole('group', { name: 'Acciones del registro' })).toHaveCount(1);
    await expect(fila.locator('td:not(:last-child)').getByRole('button')).toHaveCount(0);
    await expect(celda.getByRole('button')).toHaveCount(nombre === 'Maquinarias' ? 2 : 3);
    for (const operacion of operaciones.filter(
      (operacion) => nombre !== 'Maquinarias' || operacion.nombre !== 'Eliminar registro',
    )) {
      await expect(celda.getByRole('button', { name: operacion.nombre, exact: true })).toHaveCSS(
        'color',
        operacion.color,
      );
    }
    const posiciones = await celda.getByRole('button').evaluateAll((botones) =>
      botones.map((boton) => {
        const rectangulo = boton.getBoundingClientRect();
        return {
          x: rectangulo.x,
          y: rectangulo.y,
          ancho: rectangulo.width,
          alto: rectangulo.height,
        };
      }),
    );
    expect(
      posiciones.every(
        (posicion) =>
          Math.abs(posicion.y - posiciones[0].y) < 1 && posicion.ancho >= 40 && posicion.alto >= 40,
      ),
    ).toBe(true);
    expect(
      posiciones.every(
        (posicion, indice) =>
          indice === 0 || posicion.x >= posiciones[indice - 1].x + posiciones[indice - 1].ancho + 5,
      ),
    ).toBe(true);
    await celda.getByRole('button', { name: 'Consultar registro', exact: true }).focus();
    await expect(
      page.getByRole('tooltip', { name: 'Consultar registro', exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: informacion.outputPath(`acciones-${nombre}.png`),
      fullPage: true,
    });
  }
  await navegar(page, informacion, 'Control Diario');
  const region = page.getByRole('region', {
    name: 'Tabla de registros, desplazable horizontalmente',
  });
  await expect(region.getByRole('columnheader')).toHaveCount(10);
  await expect(region.getByRole('columnheader').nth(8)).toHaveText('Alerta');
  await expect(region.getByRole('columnheader').nth(9)).toHaveText('Estado del consumo');
  await expect(region.getByRole('columnheader', { name: 'Acciones', exact: true })).toHaveCount(0);
  await expect(
    region.getByRole('button', {
      name: /Consultar registro|Editar registro|Eliminar registro|Ver historial/,
    }),
  ).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Registrar operación', exact: true })).toHaveCount(
    0,
  );
  await expect(page.getByRole('button', { name: 'Exportar Excel', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Exportar PDF', exact: true })).toBeVisible();
  await page.screenshot({
    path: informacion.outputPath('control-solo-consulta.png'),
    fullPage: true,
  });
});

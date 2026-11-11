import { test, expect } from '@playwright/test';
import { iniciarSesion } from './ayudantes';
test.use({ timezoneId: 'America/Monterrey' });
test('consulta historial local sin futuros, resume responsables y despliega los cuatro apartados', async ({
  page,
}, informacion) => {
  await page.clock.setFixedTime(new Date('2026-11-07T15:30:45.123Z'));
  await page.goto('/maquinarias');
  await iniciarSesion(page);
  await page.evaluate(() => {
    const base = JSON.parse(localStorage.getItem('marimba.datos.v1')!);
    const maquina = base.maquinarias[0];
    const responsable = {
      motivo: 'Cambio registrado',
      registradoEn: '2026-11-06T14:00:00Z',
      usuarioResponsableId: 'usr-ana',
      usuarioResponsableNombre: 'Ana Martínez',
    };
    base.asignacionesOperadores = [
      {
        ...responsable,
        id: 'op-1',
        maquinariaId: maquina.id,
        operador: 'Operador anterior',
        inicio: '2026-11-05T14:00:00Z',
        fin: '2026-11-06T14:00:00Z',
        asignacionAnteriorId: null,
        cierre: responsable,
      },
      {
        ...responsable,
        id: 'op-2',
        maquinariaId: maquina.id,
        operador: 'Operador reciente',
        inicio: '2026-11-06T14:00:00Z',
        fin: null,
        asignacionAnteriorId: 'op-1',
      },
    ];
    const actor = {
      motivo: 'Cambio registrado',
      registradoEn: '2026-11-06T14:00:00Z',
      usuarioId: 'usr-ana',
      usuarioNombre: 'Ana Martínez',
    };
    maquina.periodosResidentes = [
      {
        ...actor,
        id: 'res-1',
        residenteId: 'cat-ant',
        nombre: 'Residente anterior',
        pk: '010+100',
        inicio: '2026-11-05T14:00:00Z',
        fin: '2026-11-06T14:00:00Z',
        cierre: actor,
      },
      {
        ...actor,
        id: 'res-2',
        residenteId: 'cat-rec',
        nombre: 'Residente reciente',
        pk: '020+200',
        inicio: '2026-11-06T14:00:00Z',
        fin: null,
      },
    ];
    const servicio = base.mantenimientos[0];
    base.mantenimientos.push({
      ...servicio,
      id: 'serv-rec',
      fecha: '2026-11-06',
      lecturaHorometro: 2470,
      tipoServicio: 'Servicio reciente',
      historial: [
        {
          ...servicio.historial[0],
          fecha: '2026-11-06T14:00:00Z',
          valores: {
            fecha: '2026-11-06',
            tipoServicio: 'Servicio reciente',
            lecturaHorometro: 2470,
          },
        },
      ],
    });
    localStorage.setItem('marimba.datos.v1', JSON.stringify(base));
  });
  await page.reload();
  await page.getByLabel('Buscar registros').fill('EXC-001');
  const antes = await page.evaluate(() => localStorage.getItem('marimba.datos.v1'));
  await page.getByRole('button', { name: 'Consultar registro', exact: true }).click();
  const dialogo = page.getByRole('dialog');
  await expect(dialogo.locator('.modal-dialog')).toHaveCSS('transform', 'none');
  const actividadDesdeAntes = await dialogo.locator('#actividad-desde').inputValue();
  await dialogo.getByRole('tab', { name: 'Historial', exact: true }).click();
  const fecha = dialogo.getByLabel('Consultar historial por fecha', { exact: true });
  await expect(fecha).toHaveAttribute('type', 'date');
  await expect(fecha.locator('..').locator('time')).toHaveText('07/11/2026');
  await expect(fecha).toHaveValue('2026-11-07');
  await expect(fecha).toHaveAttribute('max', '2026-11-07');
  const resumen = dialogo.getByRole('status', { name: 'Responsables en la fecha seleccionada' });
  await expect(resumen).toContainText('Operador reciente');
  await expect(resumen).toContainText('Residente reciente');
  await expect(resumen).toContainText('020+200');
  await fecha.fill('2026-11-05');
  await expect(resumen).toContainText('Operador anterior');
  await expect(resumen).toContainText('Residente anterior');
  await expect(resumen).toContainText('010+100');
  await fecha.fill('2026-11-06');
  const nombresOperadores = resumen.getByRole('region', { name: 'Operador de la fecha' });
  await expect(nombresOperadores.locator('li')).toHaveText([
    'Operador anterior',
    'Operador reciente',
  ]);
  await expect(
    resumen.getByRole('region', { name: 'Residentes y ubicaciones de la fecha' }).locator('li'),
  ).toHaveText(['Residente anterior010+100', 'Residente reciente020+200']);
  await fecha.fill('2026-11-01');
  await expect(resumen).toContainText('Sin asignación registrada');
  await fecha.fill('2026-11-08');
  await expect(dialogo.getByRole('alert')).toContainText('anterior');
  await expect(fecha).not.toHaveValue('2026-11-08');
  await dialogo.getByRole('button', { name: 'Hoy', exact: true }).click();
  await expect(fecha).toHaveValue('2026-11-07');
  await expect(resumen).toContainText('Residente reciente');
  const zona = dialogo.getByRole('tabpanel', { name: 'Historial', exact: true });
  const apartados = zona.locator('section > [data-apartado-historial]');
  await expect(apartados).toHaveCount(4);
  const limites = await dialogo.locator('.modal-content').boundingBox();
  const ultimoResumen = await apartados.last().locator(':scope > h3 > button').boundingBox();
  expect(limites!.height).toBeLessThanOrEqual(page.viewportSize()!.height * 0.9 + 2);
  expect(limites!.y + limites!.height - (ultimoResumen!.y + ultimoResumen!.height)).toBeLessThan(
    32,
  );
  await page.screenshot({ path: informacion.outputPath('historial-fecha.png') });
  for (const titulo of [
    'Operadores',
    'Residentes y ubicaciones',
    'Mantenimientos',
    'Modificaciones',
  ]) {
    const etiqueta = zona.getByText(titulo, { exact: true });
    await expect(etiqueta.locator('..').locator('.badge')).toHaveText(
      titulo === 'Modificaciones' ? '1' : '2',
    );
    await etiqueta.click();
  }
  await expect(
    zona.getByRole('region', { name: 'Historial cronológico de operadores' }).locator('li').first(),
  ).toContainText('Operador reciente');
  await expect(
    zona.getByRole('region', { name: 'Historial cronológico de residentes' }).locator('li').first(),
  ).toContainText('Residente reciente');
  const servicios = apartados
    .nth(2)
    .getByRole('region', { name: 'Historial de mantenimientos' })
    .locator('li');
  await expect(servicios.first()).toContainText('Servicio reciente');
  await expect(zona.locator('form, select, textarea, button[type="submit"]')).toHaveCount(0);
  await expect(zona.locator('input')).toHaveCount(1);
  await expect(zona.getByRole('button')).toHaveCount(5);
  await expect(
    zona.getByRole('button', { name: /Registrar|Guardar|Editar|Eliminar|Cambiar|Asignaciones/ }),
  ).toHaveCount(0);
  const ultimo = zona
    .getByRole('region', { name: 'Historial de modificaciones de maquinaria' })
    .locator('li')
    .last()
    .locator('dd')
    .last();
  await expect(apartados.last().locator('.collapse.show')).toBeVisible();
  await ultimo.scrollIntoViewIfNeeded();
  const final = await ultimo.boundingBox();
  const espacio = await zona.boundingBox();
  expect(final!.y + final!.height).toBeLessThanOrEqual(espacio!.y + espacio!.height + 1);
  await expect(
    dialogo.locator('.modal-header').getByRole('button', { name: 'Cerrar', exact: true }),
  ).toBeInViewport();
  await expect(dialogo.getByRole('tab', { name: 'Historial', exact: true })).toBeInViewport();
  await expect(zona.locator('input[type="datetime-local"], input[type="time"]')).toHaveCount(0);
  expect(await zona.innerText()).not.toMatch(/\b\d{1,2}:\d{2}\b/);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.screenshot({ path: informacion.outputPath('historial.png') });
  await zona.getByText('Operadores', { exact: true }).click();
  await zona.getByText('Operadores', { exact: true }).click();
  await expect(
    zona.getByRole('region', { name: 'Historial cronológico de operadores' }).locator('li'),
  ).toHaveCount(2);
  await fecha.fill('2026-11-05');
  await dialogo.getByRole('tab', { name: 'General', exact: true }).click();
  await expect(dialogo.getByRole('tabpanel', { name: 'General', exact: true })).toContainText(
    'Información general',
  );
  await expect(dialogo.locator('#actividad-desde')).toHaveValue(actividadDesdeAntes);
  await dialogo.getByRole('tab', { name: 'Historial', exact: true }).click();
  await expect(fecha).toHaveValue('2026-11-05');
  await expect(
    zona.getByRole('region', { name: 'Historial cronológico de operadores' }).locator('li'),
  ).toHaveCount(2);
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => localStorage.getItem('marimba.datos.v1'))).toBe(antes);
});

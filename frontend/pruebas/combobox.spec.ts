import { test, expect } from '@playwright/test';
import {
  confirmarCambios,
  iniciarSesionConMuestraCompleta,
  navegar,
  cerrarSesion,
} from './ayudantes';
import { normalizarNombre } from '../src/compartido/catalogos/servicios/catalogos';

test.use({ timezoneId: 'America/Monterrey' });
test('filtra, abre todas las opciones, agrega con teclado o tacto y reutiliza IDs entre formularios', async ({
  page,
}, informacion) => {
  await page.clock.setFixedTime(new Date('2026-11-09T18:00:00Z'));
  await page.goto('/maquinarias');
  await iniciarSesionConMuestraCompleta(page);
  const original = await page.evaluate(() => localStorage.getItem('marimba.datos.v1'));
  await page.getByRole('button', { name: 'Registrar maquinaria', exact: true }).click();
  const modal = page.getByRole('dialog');
  await modal.getByLabel('Número económico *').fill('PR-900');
  await modal.getByLabel('Placas *').fill('NL-PRUEBA-900');
  const tipo = modal.getByLabel('Tipo de maquinaria *');
  await tipo.fill('excav');
  await expect(modal.getByRole('option', { name: 'Excavadora', exact: true })).toBeVisible();
  await expect(modal.getByRole('option', { name: 'Compactador', exact: true })).toHaveCount(0);
  await modal
    .getByRole('button', { name: 'Mostrar todas las opciones de Tipo de maquinaria', exact: true })
    .click();
  await expect(modal.getByRole('option', { name: 'Compactador', exact: true })).toBeVisible();
  await page.screenshot({ path: informacion.outputPath('opciones-maquinaria.png') });
  const ultima = await modal.getByRole('listbox').getByRole('option').last().innerText();
  await tipo.press('ArrowUp');
  await tipo.press('Enter');
  await expect(tipo).toHaveValue(ultima);
  await tipo.fill('excav');
  await tipo.press('ArrowDown');
  await tipo.press('Enter');
  await expect(tipo).toHaveValue('Excavadora');
  await expect(tipo).toHaveAttribute('aria-expanded', 'false');
  async function agregar(etiqueta: string, valor: string) {
    await modal.getByLabel(etiqueta, { exact: true }).fill(valor);
    const opcion = modal.getByRole('option', { name: `Agregar nuevo: ${valor}`, exact: true });
    if (informacion.project.name === 'movil') await opcion.tap();
    else await opcion.click();
    await expect(modal.getByLabel(etiqueta, { exact: true })).toHaveValue(valor);
  }
  await agregar('Marca *', 'Máquinas del Norte');
  await modal.getByLabel('Modelo *', { exact: true }).fill('Serie M-20');
  await modal.getByLabel('Modelo *', { exact: true }).press('ArrowDown');
  await modal.getByLabel('Modelo *', { exact: true }).press('Enter');
  await agregar('Ingeniero residente', 'Elena Márquez Soto');
  await agregar('PK / Ubicación', '080+400');
  expect(await page.evaluate(() => localStorage.getItem('marimba.datos.v1'))).toBe(original);
  await confirmarCambios(page);
  await modal.getByRole('button', { name: 'Guardar registro', exact: true }).click();
  await expect(modal).toHaveCount(0);
  const base = await page.evaluate(() => JSON.parse(localStorage.getItem('marimba.datos.v1')!));
  const equipo = base.maquinarias.find(
    (r: { numeroEconomico: string }) => r.numeroEconomico === 'PR-900',
  );
  for (const campo of ['tipoId', 'marcaId', 'modeloId', 'residenteId', 'ubicacionResidenteId'])
    expect(base.catalogos.some((entrada: { id: string }) => entrada.id === equipo[campo])).toBe(
      true,
    );
  await navegar(page, informacion, 'Combustible');
  await page.getByRole('button', { name: 'Registrar suministro', exact: true }).click();
  await modal.getByLabel('Maquinaria *').selectOption(equipo.id);
  await modal.getByLabel('Litros solicitados *').fill('100');
  await modal.getByLabel('Litros cargados *').fill('80');
  await agregar('Operador *', 'José Manuel Ochoa');
  await modal.getByLabel('Nombre del residente', { exact: true }).fill(' ELENA MARQUEZ SOTO ');
  await expect(modal.getByRole('option', { name: /Agregar nuevo/ })).toHaveCount(0);
  await modal.getByLabel('Nombre del residente', { exact: true }).press('Escape');
  await modal.getByText('Datos complementarios del suministro', { exact: true }).click();
  await expect(modal.getByLabel('PK donde trabaja el residente')).toHaveValue('080+400');
  await agregar('Nombre del despachador', 'Adrián Pérez Ríos');
  await agregar('Tipo de combustible *', 'Biodiésel B20');
  await confirmarCambios(page);
  await modal.getByRole('button', { name: 'Guardar registro', exact: true }).click();
  await expect(modal).toHaveCount(0);
  const despues = await page.evaluate(() => JSON.parse(localStorage.getItem('marimba.datos.v1')!));
  const carga = despues.combustible.find(
    (r: { maquinariaId: string }) => r.maquinariaId === equipo.id,
  );
  expect(carga.residenteId).toBe(equipo.residenteId);
  expect(carga.nombreResidente).toBe('Elena Márquez Soto');
  expect(
    despues.catalogos.filter(
      (r: { tipo: string; nombre: string }) =>
        r.tipo === 'residentes' &&
        normalizarNombre(r.nombre) === normalizarNombre('Elena Márquez Soto'),
    ),
  ).toHaveLength(1);
  for (const campo of [
    'operadorId',
    'residenteId',
    'ubicacionId',
    'despachadorId',
    'tipoCombustibleId',
  ])
    expect(carga[campo]).toBeTruthy();
  await navegar(page, informacion, 'Horómetros');
  await page.getByRole('button', { name: 'Registrar horómetro', exact: true }).click();
  await modal.getByLabel('Maquinaria *').selectOption(equipo.id);
  await modal.getByLabel('Confirmo lectura inicial supervisada').check();
  await modal.getByLabel('Lectura final (h) *').fill('8');
  const operador = modal.getByLabel('Operador *', { exact: true });
  await operador.fill('jose manuel');
  await operador.press('ArrowDown');
  await operador.press('Enter');
  await expect(operador).toHaveValue('José Manuel Ochoa');
  await confirmarCambios(page);
  await modal.getByRole('button', { name: 'Guardar registro', exact: true }).click();
  await expect(modal).toHaveCount(0);
  await navegar(page, informacion, 'Control Diario');
  await page.getByLabel('Filtrar por maquinaria').selectOption(equipo.id);
  await expect(
    page.getByRole('region', { name: 'Tabla de registros, desplazable horizontalmente' }).locator('tbody'),
  ).toContainText('10 L/h');
  await expect(page.getByRole('button', { name: /Registrar operación|Guardar/ })).toHaveCount(0);
});

test('cancelar no guarda opciones y editar ubicación exige confirmación sin reescribir periodos', async ({
  page,
}, informacion) => {
  await page.clock.setFixedTime(new Date('2026-11-09T18:00:00Z'));
  await page.goto('/maquinarias');
  await iniciarSesionConMuestraCompleta(page);
  const original = await page.evaluate(() => localStorage.getItem('marimba.datos.v1'));
  await page.getByRole('button', { name: 'Registrar maquinaria', exact: true }).click();
  await page.getByLabel('Marca *').fill('Marca que se cancela');
  await page
    .getByRole('option', { name: 'Agregar nuevo: Marca que se cancela', exact: true })
    .click();
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  expect(await page.evaluate(() => localStorage.getItem('marimba.datos.v1'))).toBe(original);
  await page.getByLabel('Buscar registros').fill('EXC-101');
  await page.getByRole('button', { name: 'Editar registro', exact: true }).click();
  await page.getByRole('tab', { name: 'Residente', exact: true }).click();
  await expect(page.getByLabel('Ingeniero residente', { exact: true })).toHaveValue(
    'Adriana Isabel Salazar Pérez',
  );
  await page.getByLabel('Fecha de asignación *', { exact: true }).fill('2026-11-09');
  await page.getByLabel('PK / Ubicación', { exact: true }).fill('088+050');
  await page.getByRole('option', { name: 'Agregar nuevo: 088+050', exact: true }).click();
  await page.getByLabel('Motivo del cambio', { exact: false }).fill('Actualización de ubicación de prueba');
  await page.getByRole('button', { name: 'Guardar residente y ubicación', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Confirma el cambio');
  expect(await page.evaluate(() => localStorage.getItem('marimba.datos.v1'))).toBe(original);
  await page
    .getByLabel('Confirmo el cambio y conservo el historial anterior', { exact: true })
    .check();
  await page.getByRole('button', { name: 'Guardar residente y ubicación', exact: true }).click();
  await expect(page.getByLabel('Ingeniero residente', { exact: true })).toHaveValue(
    'Adriana Isabel Salazar Pérez',
  );
  await page.getByLabel('Cerrar', { exact: true }).click();
  const siguiente = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('marimba.datos.v1')!),
  );
  expect(siguiente.maquinarias[0].periodosResidentes).toHaveLength(3);
  expect(siguiente.maquinarias[0].periodosResidentes[1].pk).toBe('012+350');
  expect(siguiente.maquinarias[0].periodosResidentes[2].pk).toBe('088+050');
  expect(siguiente.horometros).toEqual(JSON.parse(original!).horometros);
  expect(siguiente.combustible).toEqual(JSON.parse(original!).combustible);
  await page.getByRole('button', { name: 'Consultar registro', exact: true }).click();
  const modal = page.getByRole('dialog');
  await expect(modal.getByRole('combobox')).toHaveCount(0);
  await expect(modal.getByRole('button', { name: /Guardar|Agregar|Eliminar|Editar/ })).toHaveCount(
    0,
  );
  await modal.getByRole('tab', { name: 'Responsables', exact: true }).click();
  await expect(modal.getByRole('tabpanel', { name: 'Responsables', exact: true })).toContainText(
    '088+050',
  );
  await modal.getByRole('tab', { name: 'Historial', exact: true }).click();
  await modal.getByText('Residentes y ubicaciones', { exact: true }).click();
  await expect(modal).toContainText('012+350');
  await expect(modal).toContainText('088+050');
  await page.screenshot({ path: informacion.outputPath('historial-ubicaciones.png') });
  await modal.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await navegar(page, informacion, 'Combustible');
  await cerrarSesion(page);
  await iniciarSesionConMuestraCompleta(page, 'prueba.restringido');
  await page.getByLabel('Filtrar por maquinaria').selectOption('prueba-maq-01');
  await page.getByRole('button', { name: 'Editar registro', exact: true }).first().click();
  await page.getByLabel('Operador *', { exact: true }).fill('Operador sin autorización');
  await expect(modal.getByRole('option', { name: /Agregar nuevo/ })).toHaveCount(0);
  await confirmarCambios(page);
  const antes = await page.evaluate(() => localStorage.getItem('marimba.datos.v1'));
  await page.getByRole('button', { name: 'Guardar registro', exact: true }).click();
  await expect(modal.getByRole('alert').filter({ hasText: 'Solo el administrador' })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('marimba.datos.v1'))).toBe(antes);
});

test('permite otro operador en una captura, confirma el cambio y conserva su asignación vigente', async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date('2026-11-09T18:00:00Z'));
  await page.goto('/horometros');
  await iniciarSesionConMuestraCompleta(page);
  const original = await page.evaluate(() => JSON.parse(localStorage.getItem('marimba.datos.v1')!));
  await page.getByRole('button', { name: 'Registrar horómetro', exact: true }).click();
  const modal = page.getByRole('dialog');
  await modal.getByLabel('Maquinaria *').selectOption('prueba-maq-01');
  const operador = modal.getByLabel('Operador *', { exact: true });
  await expect(operador).toBeEditable();
  await expect(operador).toHaveValue('José Luis García Mendoza');
  await operador.fill('Operador de relevo temporal');
  await modal
    .getByRole('option', { name: 'Agregar nuevo: Operador de relevo temporal', exact: true })
    .click();
  await expect(modal.getByLabel('Fecha de asignación del operador', { exact: true })).toHaveValue(
    '',
  );
  await operador.fill('José Luis García Mendoza');
  await operador.press('ArrowDown');
  await operador.press('Enter');
  await expect(modal.getByLabel('Fecha de asignación del operador', { exact: true })).toHaveValue(
    '2026-11-08',
  );
  await operador.fill('Operador de relevo temporal');
  await modal
    .getByRole('option', { name: 'Agregar nuevo: Operador de relevo temporal', exact: true })
    .click();
  await modal.getByLabel('Lectura final (h) *').fill('2423');
  await modal.getByRole('button', { name: 'Guardar registro', exact: true }).click();
  await expect(modal.getByRole('alert').filter({ hasText: 'Confirma el cambio' })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('marimba.datos.v1')!))).toEqual(
    original,
  );
  await confirmarCambios(page);
  await modal.getByRole('button', { name: 'Guardar registro', exact: true }).click();
  await expect(modal).toHaveCount(0);
  const siguiente = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('marimba.datos.v1')!),
  );
  expect(siguiente.asignacionesOperadores).toEqual(original.asignacionesOperadores);
  expect(siguiente.horometros.slice(1)).toEqual(original.horometros);
  expect(siguiente.horometros[0]).toMatchObject({
    operador: 'Operador de relevo temporal',
    fechaAsignacion: '',
  });
  expect(siguiente.horometros[0].operadorId).toBeTruthy();
  expect(siguiente.horometros[0].asignacionId).toBeUndefined();
});

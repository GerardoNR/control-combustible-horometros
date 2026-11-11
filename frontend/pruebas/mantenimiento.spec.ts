import { confirmarCambios } from './ayudantes';
import { test, expect } from '@playwright/test';
import { iniciarSesion } from './ayudantes';
import { fechaCorta, numero } from '../src/compartido/utilidades/formato';
import type { BaseDatos } from '../src/compartido/tipos/datos';

test.use({ timezoneId: 'America/Monterrey' });

test('explica los campos de las cuatro pestañas al editar maquinaria en pantallas pequeñas', async ({
  page,
}) => {
  await page.goto('/maquinarias');
  await iniciarSesion(page);
  await page.getByLabel('Buscar registros').fill('EXC-001');
  await page.getByRole('button', { name: 'Editar registro', exact: true }).click();
  const modal = page.getByRole('dialog');
  await expect(modal.getByRole('tab')).toHaveText([
    'Datos',
    'Residente',
    'Consumo',
    'Mantenimiento',
  ]);
  await expect(modal.getByLabel('Número económico *')).toHaveAttribute(
    'placeholder',
    'Ejemplo: EXC-009',
  );
  await expect(modal.getByLabel('Horómetro base (h) *')).toHaveAttribute(
    'placeholder',
    'Ejemplo: 1250.5',
  );
  await expect(modal.getByText('Intervalos de mantenimiento')).toBeVisible();
  await modal.getByRole('tab', { name: 'Residente', exact: true }).click();
  await expect(modal.getByRole('combobox', { name: 'Ingeniero residente' })).toBeVisible();
  await expect(
    modal.getByText(
      'Si el residente tiene un PK guardado en el catálogo, se completa automáticamente.',
    ),
  ).toBeVisible();
  await expect(modal.getByLabel('Motivo del cambio *')).toHaveAttribute(
    'placeholder',
    'Ejemplo: cambio de residente o ubicación',
  );
  await modal.getByRole('tab', { name: 'Consumo', exact: true }).click();
  await expect(modal.getByLabel('Máximo normal (L/h) *')).toHaveAttribute(
    'placeholder',
    'Ejemplo: 14.5 L/h',
  );
  await expect(modal.getByLabel('Máximo de advertencia (L/h) *')).toHaveAttribute(
    'placeholder',
    'Ejemplo: 17 L/h',
  );
  await modal.getByRole('tab', { name: 'Mantenimiento', exact: true }).click();
  await expect(modal.getByLabel('Horómetro del servicio (h) *')).toHaveAttribute(
    'placeholder',
    'Ejemplo: 1250.5',
  );
  await expect(modal.getByLabel('Tipo de servicio *')).toHaveAttribute(
    'placeholder',
    'Ejemplo: Servicio preventivo',
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await modal.getByRole('button', { name: 'Cancelar', exact: true }).click();
});

test('muestra responsables, registra servicios por horómetro y conserva el historial', async ({
  page,
}) => {
  await page.goto('/maquinarias');
  await iniciarSesion(page);
  await expect(page.locator('thead th')).toHaveText([
    'N° económico',
    'Maquinaria',
    'Operador',
    'Marca',
    'Modelo',
    'Estado',
    'Último horómetro',
    'Residente / PK',
    'Último mantenimiento',
    'Próximo mantenimiento',
    'Acciones',
  ]);
  await expect(
    page.locator('tbody').getByText('Verde · En rango', { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.locator('tbody').getByText('Amarillo · Próximo', { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.locator('tbody').getByText('Rojo · Vencido', { exact: true }).first(),
  ).toBeVisible();
  await page.getByLabel('Buscar registros').fill('EXC-001');
  await page.getByRole('button', { name: 'Editar registro', exact: true }).click();
  await page.getByRole('tab', { name: 'Datos', exact: true }).click();
  await expect(page.getByLabel('Aviso de mantenimiento (h)')).toHaveValue('200');
  await expect(page.getByLabel('Límite de mantenimiento (h)')).toHaveValue('250');
  await page.getByRole('tab', { name: 'Residente', exact: true }).click();
  const residentes = page.getByRole('combobox', { name: 'Ingeniero residente' });
  await residentes.fill('Ana Sofía Rentería Demo');
  await page.getByRole('option', { name: 'Agregar nuevo: Ana Sofía Rentería Demo' }).click();
  const ubicacion = page.getByRole('combobox', { name: 'PK / Ubicación' });
  await ubicacion.fill('012+350');
  await page.getByRole('option', { name: '012+350', exact: true }).click();
  await page.getByLabel('Motivo del cambio *').fill('Actualización para prueba visual');
  await confirmarCambios(page);
  await page.getByRole('button', { name: 'Guardar residente y ubicación', exact: true }).click();
  await expect(page.locator('tbody')).toContainText('Ana Sofía Rentería Demo');
  await expect(page.locator('tbody')).toContainText('012+350');
  await page.getByRole('tab', { name: 'Mantenimiento', exact: true }).click();
  await expect(page.getByLabel('Horómetro del servicio (h) *')).toHaveValue('2480');
  await page.getByLabel('Tipo de servicio *').fill('Servicio registrado durante la prueba');
  await page.getByLabel('Observaciones', { exact: true }).fill('Filtros y lubricación');
  await confirmarCambios(page);
  await page.getByRole('button', { name: 'Guardar mantenimiento', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Consultar registro', exact: true }).click();
  await page.getByRole('tab', { name: 'General', exact: true }).click();
  await expect(
    page.getByRole('region', { name: 'Próximo servicio' }).getByText('0 h', { exact: true }),
  ).toBeVisible();
  await page.getByRole('tab', { name: 'Historial', exact: true }).click();
  await page.getByText('Mantenimientos', { exact: true }).click();
  await expect(page.getByText('Mantenimientos', { exact: true }).locator('..')).toContainText('2');
  await expect(
    page.getByRole('dialog').getByRole('button', { name: /Registrar|Guardar/ }),
  ).toHaveCount(0);
  await expect(page.getByRole('dialog')).toContainText('Preventivo simulado');
  await expect(page.getByRole('dialog')).toContainText('Servicio registrado durante la prueba');
  await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await page.reload();
  await page.getByLabel('Buscar registros').fill('EXC-001');
  await expect(page.locator('tbody')).toContainText('Trabajadas desde el servicio: 0 h');
  await expect(page.locator('tbody')).toContainText('Ana Sofía Rentería Demo');
  await expect(page.locator('tbody')).toContainText('012+350');
});

test('muestra el servicio y el semáforo en los límites y ante lecturas inconsistentes', async ({
  page,
}) => {
  await page.goto('/maquinarias');
  await iniciarSesion(page);
  for (const [horas, estado, limite] of [
    [199, 'Verde · En rango', '51 h restantes'],
    [200, 'Amarillo · Próximo', '50 h restantes'],
    [250, 'Amarillo · Próximo', '0 h restantes'],
    [251, 'Rojo · Vencido', 'Vencido por 1 h'],
    [null, 'Revisar horómetro', null],
  ] as const) {
    const servicio = await page.evaluate((acumuladas) => {
      const base: BaseDatos = JSON.parse(localStorage.getItem('marimba.datos.v1')!);
      const equipo = base.maquinarias.find(({ numeroEconomico }) => numeroEconomico === 'EXC-001')!;
      const lectura = base.horometros.find(({ maquinariaId }) => maquinariaId === equipo.id)!;
      const servicio = base.mantenimientos!.find(({ maquinariaId }) => maquinariaId === equipo.id)!;
      if (acumuladas === null) lectura.lecturaInicial = equipo.horometroBase - 1;
      else servicio.lecturaHorometro = lectura.lecturaFinal - acumuladas;
      localStorage.setItem('marimba.datos.v1', JSON.stringify(base));
      return servicio;
    }, horas);
    await page.reload();
    await page.getByLabel('Buscar registros').fill('EXC-001');
    const fila = page.locator('tbody tr').filter({ hasText: 'EXC-001' });
    await expect(fila).toContainText(`${fechaCorta(servicio.fecha)} · ${servicio.tipoServicio}`);
    await expect(fila).toContainText(
      `Horómetro del servicio: ${numero(servicio.lecturaHorometro, 2)} h`,
    );
    await expect(fila).toContainText(`Objetivo: ${numero(servicio.lecturaHorometro + 250, 2)} h`);
    const mantenimiento = fila.getByRole('cell').filter({ hasText: 'Objetivo:' });
    await expect(mantenimiento.getByText(estado, { exact: true })).toBeVisible();
    if (horas !== null) {
      await expect(mantenimiento).toContainText(`Límite (250 h): ${limite}`);
      await expect(mantenimiento).toContainText(`Trabajadas desde el servicio: ${horas} h`);
    } else {
      await expect(mantenimiento).not.toContainText('Trabajadas desde el servicio');
    }
    await fila.getByRole('button', { name: 'Consultar registro', exact: true }).click();
    const consulta = page.getByRole('region', { name: 'Próximo servicio', exact: true });
    await expect(consulta).toContainText(estado);
    await expect(
      consulta
        .locator('dl > div')
        .filter({ has: page.getByText('Horas acumuladas', { exact: true }) })
        .locator('dd'),
    ).toHaveText(horas === null ? 'Sin datos' : `${horas} h`);
    await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
  }
  await page.evaluate(() => {
    const base: BaseDatos = JSON.parse(localStorage.getItem('marimba.datos.v1')!);
    const equipo = base.maquinarias.find(({ numeroEconomico }) => numeroEconomico === 'EXC-001')!;
    equipo.horometroBase = 0;
    const servicio = base.mantenimientos!.find(({ maquinariaId }) => maquinariaId === equipo.id)!;
    servicio.fecha = '2026-11-07';
    servicio.lecturaHorometro = 2000;
    const lecturas = base.horometros
      .filter(({ maquinariaId }) => maquinariaId === equipo.id)
      .sort((a, b) => a.fecha.localeCompare(b.fecha));
    const primera = { ...lecturas[0] };
    const segunda = {
      ...(lecturas[1] ?? primera),
      id: lecturas[1]?.id ?? crypto.randomUUID(),
      fecha: '2026-11-09',
      fechaAsignacion: '2026-11-09',
      lecturaInicial: 1825,
      lecturaFinal: 1830,
      eliminado: false,
    };
    Object.assign(primera, {
      fecha: '2026-11-08',
      fechaAsignacion: '2026-11-08',
      lecturaInicial: 1820,
      lecturaFinal: 1825,
      eliminado: false,
    });
    base.horometros = [
      ...base.horometros.filter(({ maquinariaId }) => maquinariaId !== equipo.id),
      primera,
      segunda,
    ];
    localStorage.setItem('marimba.datos.v1', JSON.stringify(base));
  });
  await page.reload();
  await page.getByLabel('Buscar registros').fill('EXC-001');
  const equipoConReferencia = page.locator('tbody tr').filter({ hasText: 'EXC-001' });
  await expect(equipoConReferencia).toContainText('Revisar horómetro');
  await expect(equipoConReferencia).toContainText(/actual \(1830 h\).*referencia.*2000 h/);
  await equipoConReferencia
    .getByRole('button', { name: 'Consultar registro', exact: true })
    .click();
  const ficha = page.getByRole('region', { name: 'Próximo servicio', exact: true });
  await expect(ficha).toContainText('Revisar horómetro');
  await expect(ficha).toContainText(/actual \(1830 h\).*referencia.*2000 h/);
  await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
});

test('consulta operadores históricos por fecha reutilizando los periodos de Horómetros', async ({
  page,
}) => {
  await page.goto('/maquinarias');
  await iniciarSesion(page);
  await page.evaluate(() => {
    const base = JSON.parse(localStorage.getItem('marimba.datos.v1')!);
    const apertura = {
      maquinariaId: 'maq-1',
      motivo: 'Alta',
      registradoEn: '2020-01-01T08:00:00Z',
      usuarioResponsableId: 'usr-ana',
      usuarioResponsableNombre: 'Ana Martínez',
    };
    base.asignacionesOperadores = [
      {
        ...apertura,
        id: 'a1',
        operador: 'Operador anterior',
        inicio: '2020-01-01T08:00:00Z',
        fin: '2020-02-01T08:00:00Z',
        asignacionAnteriorId: null,
        cierre: {
          motivo: 'Cambio de turno',
          registradoEn: '2020-02-01T08:00:00Z',
          usuarioResponsableId: 'usr-ana',
          usuarioResponsableNombre: 'Ana Martínez',
        },
      },
      {
        ...apertura,
        id: 'a2',
        operador: 'Operador actual',
        motivo: 'Cambio de turno',
        inicio: '2020-02-01T08:00:00Z',
        fin: null,
        asignacionAnteriorId: 'a1',
      },
    ];
    localStorage.setItem('marimba.datos.v1', JSON.stringify(base));
  });
  await page.reload();
  await page.getByLabel('Buscar registros').fill('EXC-001');
  await expect(page.locator('tbody')).toContainText('Operador actual');
  await page.getByRole('button', { name: 'Consultar registro', exact: true }).click();
  await page.getByRole('tab', { name: 'Historial', exact: true }).click();
  await page.getByText('Operadores', { exact: true }).click();
  await page.getByLabel('Consultar historial por fecha').fill('2020-01-15');
  await expect(page.getByRole('status')).toContainText('Operador anterior');
  await page.getByLabel('Consultar historial por fecha').fill('2020-03-15');
  await expect(page.getByRole('status')).toContainText('Operador actual');
  const historial = page.getByRole('region', { name: 'Historial cronológico de operadores' });
  await expect(historial.getByRole('heading', { level: 4 })).toHaveText([
    '01/02/2020 — Operador actual',
    '01/01/2020 — Operador anterior',
  ]);
  await expect(historial.locator('li').first()).toContainText('Desde: 01/02/2020 · Hasta: Vigente');
  await expect(historial.locator('li').last()).toContainText(
    'Desde: 01/01/2020 · Hasta: 01/02/2020',
  );
  await expect(historial.locator('li').first()).toContainText('Vigente');
  await expect(historial.locator('li').last()).toContainText('Finalizado');
  await expect(historial.getByRole('button')).toHaveCount(0);
  await expect(historial).toContainText('Cambio de turno');
  await expect(
    page.getByRole('region', { name: 'Historial cronológico de operadores' }),
  ).toContainText('Ana Martínez');
});

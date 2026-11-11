import { confirmarCambios } from './ayudantes';
import { iniciarSesion, cerrarSesion, navegar as irA } from './ayudantes';
import { test, expect } from '@playwright/test';
test('registra, valida duplicados, edita y conserva auditoría y persistencia', async ({
  page,
}, informacion) => {
  const errores: string[] = [];
  page.on('pageerror', (error) => errores.push(error.message));
  await page.goto('/maquinarias');
  await iniciarSesion(page);
  await expect(page.getByRole('heading', { name: 'Maquinarias', exact: true })).toBeVisible();
  await expect(
    page
      .getByRole('navigation', { name: 'Navegación principal' })
      .filter({ visible: true })
      .getByRole('link'),
  ).toHaveCount(informacion.project.name !== 'escritorio' ? 0 : 4);
  await page.screenshot({ path: informacion.outputPath('maquinarias.png'), fullPage: true });
  await page.getByRole('button', { name: 'Registrar maquinaria' }).click();
  await page.getByLabel('Número económico *').fill('EXC-001');
  await page.getByLabel('Placas *').fill('NL-TEST');
  await page.getByLabel('Tipo de maquinaria *').fill('Excavadora');
  await page.getByLabel('Marca *').fill('Caterpillar');
  await page.getByLabel('Modelo *').fill('320');
  await confirmarCambios(page);
  await page.getByRole('button', { name: 'Guardar registro' }).click();
  await expect(page.getByText('Este número económico ya está registrado.')).toBeVisible();
  await page.getByLabel('Número económico *').fill('EXC-099');
  await confirmarCambios(page);
  await page.getByRole('button', { name: 'Guardar registro' }).click();
  await expect(page.getByRole('status')).toContainText('Registro creado');
  await page.getByLabel('Buscar registros').fill('EXC-099');
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await cerrarSesion(page);
  await iniciarSesion(page, 'prueba.captura');
  await page.getByLabel('Buscar registros').fill('EXC-099');
  await page.getByRole('button', { name: 'Editar registro', exact: true }).click();
  await page.getByLabel('Modelo *').fill('320 GC');
  await confirmarCambios(page);
  await page.getByRole('button', { name: 'Guardar registro' }).click();
  await page.getByRole('button', { name: 'Consultar registro', exact: true }).click();
  await page.screenshot({
    path: informacion.outputPath('consulta-maquinaria.png'),
    fullPage: true,
  });
  await page.getByRole('tab', { name: 'Historial', exact: true }).click();
  await page.getByText('Modificaciones', { exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Lucía Hernández');
  await expect(page.getByRole('dialog')).toContainText('320 GC');
  await page.getByRole('button', { name: 'Cerrar' }).click();
  await page.reload();
  await page.getByLabel('Buscar registros').fill('EXC-099');
  await expect(
    page
      .getByRole('region', { name: 'Tabla de registros, desplazable horizontalmente' })
      .locator('tbody'),
  ).toContainText('320 GC');
  await page.getByLabel('Buscar registros').fill('No existe');
  await expect(page.getByText('No hay registros para mostrar')).toBeVisible();
  expect(errores).toEqual([]);
});
test('navega las cuatro pantallas y vincula combustible con control diario', async ({
  page,
}, informacion) => {
  await page.goto('/horometros');
  await iniciarSesion(page);
  await expect(page.getByRole('heading', { name: 'Horómetros', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Registrar horómetro' }).click();
  await page.getByLabel('Maquinaria *').selectOption('maq-7');
  await expect(page.getByLabel('Lectura inicial (h) *')).toHaveValue('1240');
  await page.getByLabel('Confirmo lectura inicial supervisada').check();
  await page.getByLabel('Lectura final (h) *').fill('1248');
  await page.getByLabel('Operador *').fill('Operador de prueba');
  await expect(page.getByText('Horas trabajadas: 8 h')).toBeVisible();
  await confirmarCambios(page);
  await page.getByRole('button', { name: 'Guardar registro' }).click();
  await expect(page.getByRole('status')).toContainText('Registro creado');
  const navegar = (nombre: string) => irA(page, informacion, nombre);
  await navegar('Combustible');
  await page.getByRole('button', { name: 'Registrar suministro' }).click();
  await page.getByLabel('Maquinaria *').selectOption('maq-7');
  await page.getByLabel('Litros solicitados *').fill('110');
  await page.getByLabel('Litros cargados *').fill('100');
  await page.getByLabel('Operador *').fill('Operador de prueba');
  await confirmarCambios(page);
  await page.getByRole('button', { name: 'Guardar registro' }).click();
  await expect(page.getByRole('status')).toContainText('Registro creado');
  await navegar('Control Diario');
  await expect(
    page.getByRole('button', {
      name: /^(Registrar operación|Editar registro|Consultar registro|Eliminar registro|Ver historial)$/,
    }),
  ).toHaveCount(0);
  await page.getByLabel('Filtrar por maquinaria').selectOption('maq-7');
  await expect(
    page
      .getByRole('region', { name: 'Tabla de registros, desplazable horizontalmente' })
      .locator('tbody tr'),
  ).toHaveCount(1);
  await expect(
    page
      .getByRole('region', { name: 'Tabla de registros, desplazable horizontalmente' })
      .locator('tbody'),
  ).toContainText('0.08 h/L');
  await navegar('Horómetros');
  await page.getByLabel('Filtrar por maquinaria').selectOption('maq-7');
  await expect(
    page
      .getByRole('region', { name: 'Tabla de registros, desplazable horizontalmente' })
      .locator('tbody tr'),
  ).toHaveCount(1);
  await page.getByRole('button', { name: 'Editar registro', exact: true }).click();
  await page.getByLabel('Lectura final (h) *').fill('1250');
  await confirmarCambios(page);
  await page.getByRole('button', { name: 'Guardar registro' }).click();
  await expect(
    page
      .getByRole('region', { name: 'Tabla de registros, desplazable horizontalmente' })
      .locator('tbody'),
  ).toContainText('10 h');
  await navegar('Combustible');
  await page.getByLabel('Filtrar por maquinaria').selectOption('maq-7');
  await expect(
    page
      .getByRole('region', { name: 'Tabla de registros, desplazable horizontalmente' })
      .locator('tbody tr'),
  ).toHaveCount(1);
  await page.getByRole('button', { name: 'Editar registro', exact: true }).click();
  await page.getByLabel('Litros cargados *').fill('50');
  await confirmarCambios(page);
  await page.getByRole('button', { name: 'Guardar registro' }).click();
  await expect(
    page
      .getByRole('region', { name: 'Tabla de registros, desplazable horizontalmente' })
      .locator('tbody'),
  ).toContainText('50 L');
  await navegar('Control Diario');
  await page.getByLabel('Filtrar por maquinaria').selectOption('maq-7');
  await expect(
    page
      .getByRole('region', { name: 'Tabla de registros, desplazable horizontalmente' })
      .locator('tbody tr'),
  ).toHaveCount(1);
  await expect(
    page
      .getByRole('region', { name: 'Tabla de registros, desplazable horizontalmente' })
      .locator('tbody'),
  ).toContainText('0.2 h/L');
  await page.getByLabel('Fecha hasta').fill('2099-01-01');
  await page.getByLabel('Fecha desde').fill('2099-01-01');
  await expect(page.getByText('No hay registros para mostrar')).toBeVisible();
  await page.getByRole('button', { name: 'Limpiar filtros' }).click();
  await expect(
    page
      .getByRole('region', { name: 'Tabla de registros, desplazable horizontalmente' })
      .locator('tbody tr'),
  ).toHaveCount(5);
  const ancho = await page.evaluate(() => ({
    contenido: document.documentElement.scrollWidth,
    pantalla: window.innerWidth,
  }));
  expect(ancho.contenido).toBeLessThanOrEqual(ancho.pantalla);
});

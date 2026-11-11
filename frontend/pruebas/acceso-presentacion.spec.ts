import { contrasenaPrueba } from './datos/usuarios';
import { test, expect } from '@playwright/test';
import { iniciarSesion } from './ayudantes';

test('login compacto sin credenciales y perfil sin controles de demostración', async ({
  page,
}, informacion) => {
  await page.goto('/acceso');
  await expect(page.getByRole('region', { name: 'Inicio de sesión' })).toBeVisible();
  await expect(
    page.getByText('Sistema para registrar y consultar maquinaria, horómetros y combustible'),
  ).toBeVisible();
  await expect(page.getByLabel('Usuario', { exact: true })).toHaveValue('');
  await expect(page.getByLabel('Contraseña', { exact: true })).toHaveValue('');
  await expect(page.locator('input')).toHaveCount(2);
  await expect(page.getByText('Cuentas ficticias para probar')).toHaveCount(0);
  await expect(page.getByText(contrasenaPrueba, { exact: false })).toHaveCount(0);
  await page.getByRole('button', { name: 'Mostrar contraseña' }).click();
  await expect(page.getByLabel('Contraseña', { exact: true })).toHaveAttribute('type', 'text');
  await page.getByRole('button', { name: 'Ocultar contraseña' }).click();
  await expect(page.getByLabel('Contraseña', { exact: true })).toHaveAttribute('type', 'password');
  const imagen = page.locator('img');
  await expect(imagen).toHaveAttribute('src', '/imagenes/logo-control-transparente.png');
  await expect(page.getByText('Continuar como invitado')).toHaveCount(0);
  await expect
    .poll(() => imagen.evaluate((elemento: HTMLImageElement) => elemento.naturalWidth))
    .toBeGreaterThan(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: informacion.outputPath('login.png'), fullPage: true });
  await iniciarSesion(page);
  await page.locator('#selector-usuario').click();
  const menu = page.locator('.dropdown-menu.show');
  await expect(menu).toContainText('Ana Martínez');
  await expect(menu).toContainText('Administrador');
  await expect(menu.getByRole('button')).toHaveCount(1);
  await expect(menu.getByRole('button', { name: /datos de ejemplo|muestra local/i })).toHaveCount(0);
  await expect(menu.getByRole('button', { name: 'Cerrar sesión', exact: true })).toBeVisible();
  await expect(menu).not.toContainText(
    /Administrar usuarios|Catálogos y carga inicial|Cambiar de usuario/,
  );
  await menu.getByRole('button', { name: 'Cerrar sesión', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Inicio de sesión' })).toBeVisible();
});

test('usa el PNG proporcionado como respaldo sin recurrir al icono anterior', async ({ page }) => {
  await page.route('**/imagenes/logo-control-transparente.png', (ruta) => ruta.abort());
  await page.goto('/acceso');
  await expect(page.locator('img')).toHaveAttribute('src', '/imagenes/logo-control.png');
  await expect
    .poll(() => page.locator('img').evaluate((imagen: HTMLImageElement) => imagen.naturalWidth))
    .toBeGreaterThan(1);
  expect(await page.locator('img').evaluate((imagen) => getComputedStyle(imagen).objectFit)).toBe(
    'contain',
  );
  await iniciarSesion(page);
  await expect(page.locator('aside img')).toHaveAttribute('src', '/imagenes/logo-control.png');
});

test('mantiene controles uniformes al alternar el ojo y decora el fondo sin interferir', async ({
  page,
}, informacion) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/acceso');
  const usuario = page.getByLabel('Usuario', { exact: true });
  const contrasena = page.getByLabel('Contraseña', { exact: true });
  const enviar = page.getByRole('button', { name: 'Iniciar sesión', exact: true });
  await expect(usuario).toBeVisible();
  const estiloUsuario = await usuario.evaluate((elemento) => {
    const estilo = getComputedStyle(elemento);
    return {
      fondo: estilo.backgroundColor,
      altura: estilo.height,
      borde: estilo.border,
      radio: estilo.borderRadius,
    };
  });
  expect(
    await contrasena.evaluate((elemento) => {
      const estilo = getComputedStyle(elemento);
      return {
        fondo: estilo.backgroundColor,
        altura: estilo.height,
        borde: estilo.border,
        radio: estilo.borderRadius,
      };
    }),
  ).toEqual(estiloUsuario);
  expect(await enviar.evaluate((elemento) => getComputedStyle(elemento).height)).toBe(
    estiloUsuario.altura,
  );
  expect(await enviar.evaluate((elemento) => getComputedStyle(elemento).borderRadius)).toBe(
    estiloUsuario.radio,
  );
  await contrasena.fill('Clave solo para comprobar el diseño');
  const ojo = page.getByRole('button', { name: 'Mostrar contraseña', exact: true });
  const grupo = contrasena.locator('..');
  const capturarControles = () =>
    grupo.evaluate((elemento) =>
      Array.from(elemento.children).map((control) => {
        const estilo = getComputedStyle(control);
        const area = control.getBoundingClientRect();
        return {
          fondo: estilo.backgroundColor,
          color: estilo.color,
          borde: estilo.border,
          radio: estilo.borderRadius,
          x: area.x,
          y: area.y,
          ancho: area.width,
          alto: area.height,
        };
      }),
    );
  const antes = await capturarControles();
  await ojo.click();
  await expect(contrasena).toHaveAttribute('type', 'text');
  expect(await capturarControles()).toEqual(antes);
  await page.getByRole('button', { name: 'Ocultar contraseña', exact: true }).click();
  await expect(contrasena).toHaveAttribute('type', 'password');
  expect(await capturarControles()).toEqual(antes);
  await page.keyboard.press('Tab');
  await ojo.focus();
  await expect(ojo).toBeFocused();
  expect(await ojo.evaluate((elemento) => getComputedStyle(elemento).outlineStyle)).not.toBe(
    'none',
  );
  await page.keyboard.press('Space');
  await expect(contrasena).toHaveAttribute('type', 'text');
  await expect(contrasena).toHaveValue('Clave solo para comprobar el diseño');
  await contrasena.clear();
  const fondo = page.locator('main');
  for (const capa of ['::before', '::after']) {
    const estilo = await fondo.evaluate((elemento, pseudo) => {
      const decoracion = getComputedStyle(elemento, pseudo);
      return {
        puntero: decoracion.pointerEvents,
        animacion: decoracion.animationName,
        contenido: decoracion.content,
      };
    }, capa);
    expect(estilo.puntero).toBe('none');
    expect(estilo.animacion).toBe('none');
    expect(estilo.contenido).toBe('""');
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: informacion.outputPath('login-relieve.png'), fullPage: true });
});

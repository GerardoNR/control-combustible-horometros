# Almacenamiento local

La aplicación no ejecuta limpiezas ni migraciones destructivas al iniciar, iniciar sesión, recargar o reiniciar Vite. Los registros existentes y los que se capturen se conservan en el mismo origen y perfil del navegador.

## Claves actuales

- `localStorage['marimba.datos.v1']`: instantánea operativa con maquinarias, horómetros, combustible, mantenimientos, asignaciones, catálogos e historial integrado.
- `localStorage['marimba.usuarios.desarrollo.v1']`: cuentas locales de desarrollo. Su preparación conserva las cuentas válidas y sus credenciales.
- `localStorage['marimba.usuarios.v1']`: cuentas locales de la aplicación cuando no está activa la configuración de desarrollo.
- `sessionStorage['marimba.sesion.v1']`: ID de la sesión local.

La aplicación no usa IndexedDB, Cache Storage ni service workers para persistir datos operativos. El acceso a la instantánea está encapsulado en los repositorios; el acceso a cuentas y sesión, en los servicios del módulo de acceso. No se invoca `localStorage.clear()`.

## Limpieza manual

No existe una acción de limpieza conectada a la interfaz. Para retirar registros, debe diseñarse una operación administrativa explícita que inspeccione las claves del origen, confirme las claves desconocidas y actualice también el estado de React. No eliminar claves por prefijo amplio ni modificar cuentas, sesión o preferencias ajenas.

Las claves `marimba.migraciones.*` pueden quedar de instalaciones anteriores, pero la versión actual no las consulta ni las escribe. No tienen efecto al iniciar y no deben considerarse una autorización para borrar datos.

## Autenticación y backend

Las cuentas locales de desarrollo son exclusivamente para la demo; no son credenciales de producción. La integración remota sustituirá `AccesoLocal` por un adaptador de `ServicioAcceso`, con sesión segura del servidor. Los datos operativos pasarán del repositorio local al adaptador REST; ningún componente debe acceder directamente al almacenamiento del navegador.

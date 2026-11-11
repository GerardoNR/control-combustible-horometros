# Arquitectura del frontend

El código vive en `frontend/`. React y React Router componen la interfaz; Bootstrap/React Bootstrap aportan presentación; TypeScript y Zod describen y validan modelos; React Hook Form gestiona formularios. No hay backend ni base de datos.

- `src/aplicacion/`: entrada, rutas protegidas, navegación y estilos generales.
- `src/modulos/acceso/`: login, interfaces de sesión/cuenta, validaciones y permisos de administrador, capturista e invitado. Las cuentas locales temporales se preparan solo en Vite de desarrollo con API vacía; su módulo se importa dinámicamente y se elimina del grafo de producción. El modo `pruebas` utiliza identidades sintéticas independientes.
- `src/modulos/maquinarias/`: equipos, responsables vigentes, periodos históricos, referencias de mantenimiento y parámetros de consumo.
- `src/modulos/horometros/`: lecturas, horas calculadas, consistencia cronológica y operador histórico.
- `src/modulos/combustible/`: suministros, solicitado/cargado, responsables, PK, orquesta y despachador.
- `src/modulos/control-diario/`: consolidación de las fuentes por maquinaria/fecha, filtros, totales e indicadores. No admite altas independientes.
- `src/compartido/`: tipos, servicios, contextos, catálogos, validaciones y componentes reutilizables.

`ProveedorSesion` consume `ServicioAcceso`. `ProveedorDatos` selecciona `RepositorioLocal` o `RepositorioApi` mediante `VITE_API_URL`. Los adaptadores conservan el contrato de negocio; las reglas puras validan relaciones, cálculos, permisos y concurrencia antes de escribir. Las consultas e historiales no escriben datos; las bajas son lógicas y preservan auditoría.

El repositorio local inicia con arreglos vacíos. No hay semillas operativas ni botones de carga de muestras. Los datos de `pruebas/datos/` se importan únicamente desde pruebas. La migración de limpieza se conserva como utilidad explícita, pero no se ejecuta automáticamente desde `principal.tsx`. Consultar [almacenamiento](limpieza-almacenamiento-local.md).

El último horómetro y Control Diario son derivados. `mantenimiento.ts` centraliza continuidad acumulada, referencia de servicio, objetivo, horas restantes y progreso. `evaluacion-consumo.ts` y `alertas-maquinaria.ts` centralizan rangos, comparabilidad por régimen y niveles reutilizados por pantalla y exportadores. `responsables.ts` resuelve el único residente/PK vigente para las vistas operativas; los suministros y periodos conservan sus instantáneas históricas. Cambiar responsables actuales conserva los nombres y periodos de las fuentes históricas. Semáforos y consumo dependen de parámetros válidos; no se inventan referencias faltantes. La jornada sin parámetro validado queda sin evaluar.

Los exportadores Excel/PDF se cargan bajo demanda y reciben todos los resultados filtrados antes de paginar. Excel mantiene 11 columnas; PDF una tabla principal de 10 columnas y un resumen textual de indicadores. Los estados operativos/mantenimiento son actuales, no reconstrucciones históricas diarias.

Mantener las pruebas unitarias cerca de los servicios y las de interfaz en `pruebas/`. Las pruebas ejercitan captura, edición, baja, historial, filtros, consolidación, persistencia, permisos, exportación y estado inicial vacío. Los componentes internos de administración/importación se conservan para integrar datos reales, pero no hay acciones del producto para generar datos ficticios.

Pendientes: proveedor de identidad real, sesiones seguras, autorización de servidor, auditoría inmutable, integridad por ID, unicidad, transacciones, precisión/zona operativa, errores de dominio e idempotencia. El almacenamiento del navegador es manipulable y no proporciona seguridad de producción. Los [contratos REST](contratos-api.md) detallan el acuerdo esperado; no se implementan servicios de servidor en este proyecto.

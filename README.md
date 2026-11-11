# Control de Maquinaria

Frontend modular con React, TypeScript, Vite, Bootstrap y React Bootstrap para maquinaria, horómetros, combustible y Control Diario. No incluye backend ni base de datos.

## Instalación y ejecución

Requiere Node.js 22.12 o posterior compatible con Vite 7 y npm.

```bash
cd frontend
npm ci
cp .env.example .env.local
npm run dev
```

Abrir la dirección local indicada por Vite. En desarrollo local, con `VITE_API_URL` vacío, están disponibles exclusivamente `admin1` y `admin2`, ambos administradores temporales. El formulario inicia sin usuario ni contraseña y no muestra credenciales. Su configuración está aislada en `frontend/src/modulos/acceso/servicios/cuentas-desarrollo.ts`; no se incluye en la compilación de producción ni se habilita al conectar la API. Usar estas cuentas solo en localhost, nunca con datos o credenciales de producción.

Las contraseñas se persisten como derivados PBKDF2 con sal individual, no como texto plano. Esto no convierte la autenticación del navegador en seguridad real. El backend deberá implementar sesiones, autorización por operación y almacenamiento seguro de contraseñas. Una compilación de producción no crea cuentas ni ofrece un administrador predeterminado.

## Estructura

```text
.
├── frontend/
│   ├── public/              # Logotipos y recursos estáticos
│   ├── src/
│   │   ├── aplicacion/
│   │   ├── compartido/      # Catálogos, servicios, tipos, validaciones y contextos
│   │   └── modulos/         # Acceso, maquinarias, horómetros, combustible y control-diario
│   ├── pruebas/             # Interfaz y datos temporales aislados
│   ├── package.json
│   ├── package-lock.json
│   ├── vite.config.ts
│   ├── playwright.config.ts
│   └── tsconfig*.json
├── docs/
│   ├── arquitectura.md
│   ├── contratos-api.md
│   └── limpieza-almacenamiento-local.md
├── .gitignore
└── README.md
```

## Datos y almacenamiento

Una instalación nueva tiene cero registros operativos, catálogos, asignaciones, servicios e historiales. Control Diario se calcula automáticamente desde Horómetros y Combustible. Los formularios permiten registrar datos nuevos; abrir un formulario o actualizar la página no inserta muestras.

La aplicación no limpia datos operativos al iniciar ni al recargar. El repositorio local usa `marimba.datos.v1`; la preparación de cuentas de desarrollo es independiente y no sustituye las credenciales existentes. No se usa `localStorage.clear()`. Consultar la [guía de almacenamiento](docs/limpieza-almacenamiento-local.md).

Los datos sintéticos de `frontend/pruebas/datos/` pertenecen exclusivamente a las pruebas, no al estado inicial ni al build. Los navegadores de Playwright son temporales y se cierran al finalizar. Los resultados y dependencias regenerables están ignorados en Git.

## Validación

Ejecutar desde `frontend/`:

```bash
npm run lint
npm run typecheck
npm test
npm run test:interfaz
npm run build
```

La comprobación del contenido PDF requiere `pdftotext` (Poppler) en el entorno de pruebas. Playwright necesita Chromium (`npx playwright install chromium`) o un navegador compatible indicado mediante `CHROME_BIN=/usr/bin/google-chrome npm run test:interfaz -- --workers=4`. Arranca tres servidores locales: 5173 en modo de pruebas aisladas, 5174 para comprobar las cuentas de desarrollo y 5175 para verificar el build de producción. Ejecutar `npm run build` antes de las pruebas de interfaz. No reutilizar esos puertos con otras instancias de Vite. Incluye escritorio, tablet y celular emulados, persistencia, permisos, flujos de captura y exportaciones XLSX/PDF. Una prueba adicional arranca Vite en los puertos 5180–5182 y reinicia tanto el servidor como un navegador con perfil temporal para comprobar que las cuentas y registros nuevos sobreviven; ese perfil se elimina al finalizar. Dos escenarios administrativos sin acceso en el menú actual siguen omitidos; los servicios correspondientes tienen pruebas unitarias.

Maquinarias centraliza el residente/PK vigente, conserva las asignaciones anteriores en Ver y calcula el mantenimiento desde lecturas acumuladas válidas. Consumo permite límites propios con referencia autorizada y, opcionalmente, jornada y rangos de ralentí. Control Diario muestra alertas desplegables para el periodo filtrado; sin parámetros o datos comparables indica Sin evaluar.

Excel y PDF conservan una tabla principal de 11 columnas. Excel incluye colores y TOTAL GENERAL; PDF incluye encabezado, periodo y totales. Ambos exportan todos los registros filtrados y se verifican con datos temporales aislados.

## Integración y distribución

`VITE_API_URL`, en `frontend/.env.local`, selecciona el adaptador REST de operaciones. Reiniciar Vite o recompilar después de modificarla. No poner secretos en variables Vite. La autenticación real debe conectarse mediante `ServicioAcceso`; configurar solo la URL no implementa sesiones.

Consultar [arquitectura](docs/arquitectura.md) y [contratos API](docs/contratos-api.md) para módulos, entidades, relaciones, validaciones, errores y transacciones. Servir únicamente `frontend/dist/`, con fallback SPA a `index.html`. No publicar Vite de desarrollo. Permanecen avisos de tamaño de ExcelJS y dependencias transitivas; esta validación funcional no sustituye una auditoría de seguridad.

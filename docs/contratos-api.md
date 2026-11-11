# Contratos REST esperados

Código vigente bajo `frontend/`. No incluye backend ni base de datos. Las credenciales y los datos de los ejemplos son marcadores de formato, nunca cuentas precargadas.


`VITE_API_URL` indica la base, por ejemplo `https://api.ejemplo.com/v1`. No hay backend incluido. Los nombres JSON se mantienen en español; fechas de operación `YYYY-MM-DD`, hora local `HH:mm`, auditoría ISO 8601 con zona horaria, cantidades numéricas sin unidades incorporadas.

## Endpoints

Para cada recurso de captura `maquinarias`, `horometros` y `combustible`:

| Método | Ruta              | Solicitud                  | Respuesta esperada                          |
| ------ | ----------------- | -------------------------- | ------------------------------------------- |
| GET    | `/{recurso}`      | Sin cuerpo                 | `200`, arreglo completo de registros        |
| POST   | `/{recurso}`      | Datos de negocio           | `201`, `{revision, registro}` con auditoría |
| PUT    | `/{recurso}/{id}` | Todos los datos de negocio | `200`, `{revision, registro}` actualizado   |

El adaptador actual carga **una instantánea consistente** mediante `GET /operaciones/snapshot`, no cuatro GET independientes. Los GET individuales pueden servir a otros clientes, pero no se usan para construir Control Diario. La consulta individual, los filtros, la paginación y las exportaciones del frontend utilizan el conjunto completo cargado. Un GET paginado no es compatible todavía: al escalar, acordar paginación/reporte de servidor sobre una misma revisión, nunca mezclar páginas de distintas revisiones.

`DELETE /horometros/{id}` y `DELETE /combustible/{id}` deben responder `200` con `{revision, registro}`. `registro` contiene `eliminado: true`, autor/fecha de modificación y un nuevo evento `Eliminación`; no responder 204. La eliminación es lógica e idempotente por política del servidor, sin borrar la auditoría. No se solicitan endpoints de eliminación de maquinaria ni cuentas. Control Diario es de solo lectura: no habilitar POST, PUT, PATCH ni DELETE para ningún rol.

Headers: `Content-Type: application/json` y, al guardar, `X-Usuario-Demo: <id-del-usuario-local>`. No es autenticación; sustituir por una sesión real y un proveedor de autenticación/usuarios que implemente `ServicioAcceso`. El acceso y la gestión de cuentas actuales son locales incluso al configurar `VITE_API_URL`. El servidor debe determinar el autor y las fechas, ignorando atribuciones arbitrarias del cliente.

El adaptador usa tiempo máximo de 15 segundos, valida JSON con Zod y muestra errores de conexión/respuesta. Deben configurarse HTTPS y CORS para el origen del frontend y los headers acordados. No contiene credenciales ni acceso a base de datos.

## Cuerpos de altas y ediciones

### Maquinarias

```json
{
  "numeroEconomico": "EXC-009",
  "placas": "NL-5839-A",
  "tipo": "Excavadora",
  "marca": "Caterpillar",
  "modelo": "320 GC",
  "estado": "Operativa",
  "horometroBase": 2410.5
}
```

Estado: `Operativa`, `En mantenimiento` o `Fuera de servicio`. Número económico único, normalizado a mayúsculas, sin espacios externos. Letras, números o guiones. Placas en mayúsculas. Campos de texto obligatorios, máximo 120 caracteres. Horómetro base numérico no negativo; no es una lectura diaria.

### Horómetros

```json
{
  "fecha": "2026-11-06",
  "maquinariaId": "maq-1",
  "lecturaInicial": 2410.5,
  "lecturaFinal": 2418.5,
  "fechaAsignacion": "2026-11-01",
  "horaAsignacion": "07:30",
  "operador": "José Luis García"
}
```

Equipo existente, lecturas no negativas, final ≥ inicial, diferencia ≤ 24 horas, asignación ≤ fecha. Varios intervalos por equipo y fecha, sin superposición y con suma diaria ≤ 24 horas; consistencia cronológica entre días anteriores y posteriores. Horas calculadas, no enviadas. Puede incluir `actividad` como texto opcional de hasta 120 caracteres, conservado en registros anteriores o provisto por el backend de origen; los formularios vigentes no capturan actividad/frente y Control Diario es de consulta.

`fechaAsignacion` permanece en los datos aunque ya no aparezca en la tabla. `horaAsignacion` es opcional y usa `HH:mm` o cadena vacía si no se conoce; también puede omitirse en registros anteriores. No deducirla de `creadoEn`. La tabla y los formularios identifican al conductor como **Operador**, mientras el usuario de auditoría es la cuenta que registra/modifica la información. Los movimientos efectivos de operadores se gestionan en la colección independiente descrita más adelante, sin modificar los operadores históricos de las fuentes.

### Combustible

```json
{
  "fecha": "2026-11-06",
  "maquinariaId": "maq-1",
  "litrosSolicitados": 100,
  "litrosCargados": 95.5,
  "tipoCombustible": "Diésel",
  "operador": "José Luis García",
  "horaCarga": "07:30",
  "nombreResidente": "Adriana Salazar",
  "pkResidente": "012+350",
  "numeroOrquesta": "ORQ-007",
  "nombreDespachador": "Arturo Pérez"
}
```

Tipo: `Diésel` o `Gasolina`. Solicitud > 0 y carga ≥ 0; se admite sobrecarga y múltiples suministros en el día. Diferencia = solicitados − cargados, no enviada. No hay precio ni costo en este contrato; requiere acuerdo posterior. Puede incluir `actividad` como texto opcional de hasta 120 caracteres, proveniente de la fuente. El formulario vigente conserva actividad/frente anteriores al editar, sin ofrecerlos como captura.

Los cuatro campos nuevos son cadenas opcionales, compatibles con registros antiguos que no los incluyen. `nombreResidente` y `nombreDespachador`: máximo 120 caracteres; `pkResidente`: máximo 60 caracteres, conserva la referencia de trabajo sin imponer un formato de PK no acordado; `numeroOrquesta`: máximo 40 caracteres de letras, números, espacios, punto, guion, guion bajo o barra. Se eliminan espacios externos. Se admite cadena vacía cuando no hay información y no se rellena desde el usuario activo ni con datos de prueba. El número de orquesta es texto para conservar ceros iniciales y códigos alfanuméricos. Las respuestas, instantáneas y auditoría deben conservar estos campos. El frontend muestra residente y PK en dos líneas dentro de una sola columna.

No se agrega un segundo campo de litros: `litrosCargados` sigue siendo la única cantidad realmente suministrada, utilizada por los totales y por la consolidación/exportaciones de Control Diario. Las columnas Cantidad solicitada/Cantidad cargada corresponden a `litrosSolicitados`/`litrosCargados`. El backend deberá validar los nuevos datos y mantenerlos al editar, sin eliminar su historial ni sustituir los valores ausentes por información inventada.

### Control diario: solo consulta

No enviar altas ni ediciones manuales de Control Diario. El frontend rechaza tales escrituras en su lógica de negocio y no presenta controles ni formularios para ningún usuario. El backend deberá rechazar escrituras sobre ese recurso con `403` o `405`, también para administradores.

Las filas se construyen únicamente con fuentes activas que compartan `maquinariaId` y fecha operativa. Horas y litros se agregan por separado. L/h = litros cargados / horas trabajadas; h/L es el inverso. Ambos requieren las dos fuentes válidas y sumas de horas y litros mayores a cero. Datos incompletos se muestran pendientes. Las fechas operativas no deben desplazarse por convertirlas a UTC.

Actividad/frente y operador se toman de las fuentes, con valores únicos ordenados, sin fabricar datos. `actividad` es opcional; `operador` mantiene el contrato de las fuentes existentes. Si la API no proporciona actividad, se muestra pendiente y el filtro por actividad no devolverá esas filas al buscar un texto concreto.

El arreglo `control-diario` de instantáneas antiguas puede conservar metadatos manuales por compatibilidad histórica. El adaptador todavía acepta ese arreglo (usar `[]` en un backend nuevo), pero la consolidación ya no lo utiliza ni escribe en él. Estos registros no crean filas ni se transfieren silenciosamente a las fuentes.

## Registro de respuesta y auditoría

Los endpoints operativos de escritura devuelven `{ "revision": "\"rev-43\"", "registro": { ... } }`. El objeto `registro` contiene los datos del recurso y los campos de auditoría siguientes (ejemplo de ese objeto de maquinaria):

```json
{
  "id": "maq-9",
  "numeroEconomico": "EXC-009",
  "placas": "NL-5839-A",
  "tipo": "Excavadora",
  "marca": "Caterpillar",
  "modelo": "320 GC",
  "estado": "Operativa",
  "horometroBase": 2410.5,
  "creadoEn": "2026-11-06T14:00:00Z",
  "creadoPor": "Ana Martínez",
  "modificadoEn": "2026-11-06T15:00:00Z",
  "modificadoPor": "Lucía Hernández",
  "historial": [
    {
      "fecha": "2026-11-06T14:00:00Z",
      "usuarioId": "usr-ana",
      "usuarioNombre": "Ana Martínez",
      "accion": "Creación",
      "valores": {
        "numeroEconomico": "EXC-009",
        "placas": "NL-5839-A",
        "tipo": "Excavadora",
        "marca": "Caterpillar",
        "modelo": "320 GC",
        "estado": "En mantenimiento",
        "horometroBase": 2410.5
      }
    },
    {
      "fecha": "2026-11-06T15:00:00Z",
      "usuarioId": "usr-lucia",
      "usuarioNombre": "Lucía Hernández",
      "accion": "Edición",
      "anteriores": {
        "numeroEconomico": "EXC-009",
        "placas": "NL-5839-A",
        "tipo": "Excavadora",
        "marca": "Caterpillar",
        "modelo": "320 GC",
        "estado": "En mantenimiento",
        "horometroBase": 2410.5
      },
      "valores": {
        "numeroEconomico": "EXC-009",
        "placas": "NL-5839-A",
        "tipo": "Excavadora",
        "marca": "Caterpillar",
        "modelo": "320 GC",
        "estado": "Operativa",
        "horometroBase": 2410.5
      }
    }
  ]
}
```

`id`: cadena opaca y estable. Historial ordenado del más antiguo al más reciente. `valores` y `anteriores` contienen los datos de negocio completos del recurso, sin auditoría ni valores derivados. La UI presenta solo los campos modificados. En una eliminación, el evento puede contener `valores: {"eliminado":"Sí"}` y `anteriores: {"eliminado":"No"}`, conservando los datos de negocio en el registro marcado. Conservar usuario ID y nombre histórico aunque el perfil cambie.

## Errores y pendientes del backend

Códigos esperados: `400` validación, `401` sin sesión, `403` sin permiso, `404` inexistente, `409` duplicado o conflicto, `500` error. Se propone cuerpo `{ "codigo": "NUMERO_DUPLICADO", "mensaje": "El número económico ya existe.", "campos": { "numeroEconomico": "Duplicado" } }`. El adaptador actual muestra un mensaje general con el estado HTTP, sin exponer cuerpos sin validar. Mapear errores por campo cuando el backend confirme el contrato.

Pendientes: implementar los endpoints de autenticación y usuarios descritos abajo, permisos por rol y módulo, unicidad e integridad transaccional, límites y precisión numérica, historial inmutable, instantáneas y control de concurrencia de servidor mediante revisión e `If-Match`, paginación de servidor si es necesaria y definición de costos/rendimientos adicionales. La protección entre pestañas locales no reemplaza concurrencia del backend.

## Autenticación futura (no implementada)

La interfaz `ServicioAcceso` separa el comportamiento de sesión del almacenamiento local. Sustituir `AccesoLocal` por un adaptador real al integrar el backend. El frontend actual no envía las contraseñas ficticias a la API, no obtiene tokens y no consume estos endpoints.

Se propone sesión mediante cookie `HttpOnly`, `Secure`, `SameSite` apropiado al despliegue, transportada exclusivamente por HTTPS. El backend determinará expiración, renovación, protección CSRF, invalidación y política de contraseñas. El adaptador deberá usar `credentials: 'include'` y CORS con origen explícito cuando corresponda. No guardar contraseñas ni tokens de sesión en `localStorage`. No migrar al servidor las credenciales ni los derivados de la demostración.

| Método | Ruta propuesta            | Solicitud                     | Respuesta                                                               |
| ------ | ------------------------- | ----------------------------- | ----------------------------------------------------------------------- |
| POST   | `/autenticacion/sesion`   | `nombreUsuario`, `contrasena` | `200` usuario público + cookie de sesión                                |
| GET    | `/autenticacion/sesion`   | Cookie de sesión              | `200` usuario público vigente; `401` sin sesión                         |
| DELETE | `/autenticacion/sesion`   | Cookie de sesión              | `204`, invalidar sesión y cookie                                        |
| POST   | `/autenticacion/invitado` | Sin credenciales              | `200` usuario invitado o sesión de lectura, según política del servidor |

Solicitud de acceso de ejemplo (valores ficticios):

```json
{
  "nombreUsuario": "ana.admin",
  "contrasena": "<contraseña-del-usuario>"
}
```

Usuario público devuelto, **sin contraseña, sal ni derivados**:

```json
{
  "id": "usr-lucia",
  "nombre": "Lucía Hernández",
  "nombreUsuario": "lucia.captura",
  "rol": "CAPTURISTA",
  "iniciales": "LH",
  "activo": true,
  "permisos": ["maquinarias", "horometros", "combustible", "control-diario"]
}
```

Roles cerrados: `INVITADO`, `CAPTURISTA`, `ADMINISTRADOR`. Permisos: nombres de los cuatro recursos. En este contrato cada módulo asignado concede registro **y** edición al capturista. Todos consultan los cuatro módulos. El administrador tiene acceso completo en los tres módulos de captura y gestión de usuarios; Control Diario permanece de solo consulta para todos. El invitado no puede ejecutar escrituras, aunque envíe permisos arbitrarios. El identificador de permiso `control-diario` se acepta por compatibilidad con cuentas antiguas, pero no concede captura manual. Confirmar esta granularidad antes de ampliar el modelo.

## Usuarios (solo administrador)

| Método | Ruta propuesta          | Solicitud                                                   | Respuesta                           |
| ------ | ----------------------- | ----------------------------------------------------------- | ----------------------------------- |
| GET    | `/usuarios`             | Sesión administradora                                       | `200`, arreglo de usuarios públicos |
| POST   | `/usuarios`             | Nombre, usuario, contraseña, rol, activo, permisos          | `201`, usuario público              |
| PUT    | `/usuarios/{id}`        | Nombre, usuario, rol, activo, permisos; contraseña opcional | `200`, usuario público actualizado  |
| PATCH  | `/usuarios/{id}/estado` | `{ "activo": false }` o `true`                              | `200`, usuario público actualizado  |

El adaptador local usa `guardarUsuario` para altas, ediciones y estado; un adaptador REST podrá mapear cambios de estado al endpoint PATCH. No hay endpoint de eliminación en el alcance actual.

Ejemplo de alta:

```json
{
  "nombre": "Elena de Prueba",
  "nombreUsuario": "elena.prueba",
  "contrasena": "<contraseña-del-usuario>",
  "rol": "CAPTURISTA",
  "activo": true,
  "permisos": ["horometros", "combustible"]
}
```

La contraseña se transmite solo por HTTPS al servidor real. Al editar, omitir `contrasena` si no se modifica; el adaptador deberá convertir el campo vacío de la interfaz a ausencia del campo. El servidor no devuelve credenciales ni las incluye en historiales/logs. Derivación de contraseñas, política de longitud y complejidad, bloqueo por intentos y límites de solicitudes serán responsabilidad del backend. La política local de la demo no es una recomendación de seguridad para producción.

Unicidad de `nombreUsuario` normalizado en minúsculas sin espacios externos: garantizar con restricción transaccional de base de datos. Nombre completo obligatorio, máximo 120 caracteres. Usuario de 3–40 caracteres de letras ASCII, números, punto, guion o guion bajo. Rechazar roles y módulos desconocidos. No permitir que el cliente se asigne privilegios ni desactive su propia cuenta administradora; preservar al menos un administrador activo. Las cuentas inactivas no pueden iniciar ni mantener sesiones; aplicar cambios de rol y permisos sobre sesiones existentes.

## Autorización y auditoría reales

- Validar la sesión y autorización en **cada endpoint**, incluidas consultas, historiales y gestión de cuentas; nunca confiar en el rol o el autor enviado desde el navegador.
- GET operativos e instantáneas para invitado, capturista y administrador. POST/PUT operativos solo para administrador o capturista con permiso sobre ese recurso. DELETE de Horómetros/Combustible sigue ese mismo permiso de escritura en la demo; confirmar la política definitiva en el backend. Escrituras de invitado: `403`.
- GET/POST/PUT/PATCH de usuarios solo para administrador activo. Acceso sin sesión a endpoints privados: `401`; sesión sin permiso: `403`; duplicado o conflicto de versión: `409`.
- Eliminar `X-Usuario-Demo` al integrar la sesión real. El servidor asigna `creadoPor`, `creadoEn`, `modificadoPor`, `modificadoEn` y eventos de historial dentro de la misma transacción de la operación.
- Mantener el contrato de auditoría operativa ya descrito. Añadir en una versión acordada `creadoPorId` y `modificadoPorId`, además del nombre histórico; `historial[].usuarioId` ya existe. No romper los registros locales anteriores que no contienen esos nuevos campos.
- Auditar también creación, edición, cambios de rol/permisos y activación/desactivación de cuentas, sin incluir contraseñas ni derivados. La demo todavía no implementa un historial de administración de cuentas.
- Invalidar sesiones al cerrar sesión, desactivar cuenta o cambiar credenciales; acordar renovación y gestión de sesiones concurrentes. La demo usa eventos de almacenamiento entre pestañas y relee permisos antes de guardar, lo cual no reemplaza estas obligaciones del servidor.

## Instantánea consistente y revisiones

### GET `/operaciones/snapshot`

Respuesta `200` (cada arreglo contiene registros completos con auditoría, como los ejemplos anteriores):

```json
{
  "revision": "\"rev-42\"",
  "datos": {
    "maquinarias": [],
    "horometros": [],
    "combustible": [],
    "control-diario": [],
    "asignacionesOperadores": []
  }
}
```

Los arreglos vacíos del ejemplo representan un sistema sin registros; el servidor debe devolver todos los registros que correspondan a una misma instantánea, incluidos los tombstones necesarios para auditoría. `revision` es una etiqueta opaca apta para `If-Match` (ejemplo: cadena con comillas `"rev-42"`). El frontend no interpreta ni incrementa su valor. La instantánea debe leerse bajo una transacción/aislamiento consistente que evite combinar la maquinaria, las lecturas, las cargas o los metadatos de momentos distintos.

Cada POST/PUT/DELETE operativo envía `If-Match: "rev-42"`. El servidor compara y actualiza de forma atómica antes de escribir. Si otra transacción cambió el conjunto operativo, responder `412` (o `409`) sin aplicar la operación. El frontend muestra el conflicto y solicita cerrar el formulario y recargar. Cada escritura correcta responde `{ "revision": "\"rev-43\"", "registro": { ... } }`; registro y revisión deben proceder de la misma transacción. No debe haber cambios colaterales de otras entidades invisibles en esa respuesta: si el negocio los requiere, devolver una instantánea completa y adaptar el repositorio.

La revisión global es una estrategia inicial conservadora. Una versión futura puede utilizar revisiones por entidad/grupo, manteniendo la garantía de snapshot de lectura. La API aún no existe; los eventos `storage` actuales solo sincronizan pestañas del mismo navegador/origen. Para varios usuarios/dispositivos se requiere implementar recarga o notificaciones SSE/WebSocket con revisiones y nuevas instantáneas. No se afirma que la demo resuelva sincronización remota.

## Reglas de consolidación que deberá respetar el servidor

- Clave natural única de un consolidado: `(maquinariaId, fecha)`; ID determinista compatible `diario:${encodeURIComponent(maquinariaId)}:${fecha}`.
- `control-diario` en la instantánea es un arreglo histórico de compatibilidad, no una fuente activa. Conservarlo al leer instalaciones existentes; un backend nuevo puede entregar `[]`. No exponer escrituras manuales.
- Horómetros y suministros son las fuentes de verdad. Agrupar y sumar por separado antes de unir los agregados, o calcular con el mismo algoritmo puro del frontend. Nunca sumar sobre un JOIN de lecturas contra cargas sin preagregación.
- Incluir un par si tiene al menos una fuente activa. Devolver parciales si falta alguna fuente. Al quitar la última fuente, desaparece la fila independientemente de metadatos manuales antiguos.
- Excluir `eliminado: true` de los cálculos; conservar sus eventos en las fuentes. Un cambio de fecha o equipo mueve solo esa fuente al grupo correspondiente.
- Horas = suma de `lecturaFinal - lecturaInicial` de intervalos válidos no superpuestos. Litros = suma de `litrosCargados`, nunca `litrosSolicitados`. Rangos invertidos, cantidades negativas, no finitas o lecturas superpuestas deben rechazarse transaccionalmente; el frontend también los marca pendientes si recibe datos inconsistentes.
- Rendimiento principal `litrosHora = litros / horas` y secundario `horasLitro = horas / litros` solo con ambas sumas válidas y > 0. Usar `null` al faltar datos o no poder dividir. Cero registrado no significa fuente ausente; no convertir `null` a cero en un rendimiento.
- Totales del periodo por maquinaria: sumar horas y litros disponibles, informar registros parciales, y dividir las sumas solo si todas las filas tienen ambas fuentes válidas. No promediar cocientes ni extrapolar combustible faltante.
- Actividades y operadores provienen exclusivamente de fuentes activas: mostrar valores únicos ordenados separados por `/`. Actividad ausente queda pendiente. No dar prioridad a capturas manuales antiguas ni inventar asignaciones. Los filtros seleccionan grupos diarios completos, no prorratean los valores.
- La auditoría de fuentes sigue disponible en Horómetros y Combustible. No inventar eventos de edición al recalcular derivados. La estructura de auditoría consolidada permanece disponible para REST, pero Control Diario no abre modales ni historiales.

Si se ofrece posteriormente `GET /control-diario/consolidado` para grandes volúmenes, debe devolver la misma semántica, revisión y clave estable, con campos derivados nulos en los parciales. No mezclar ese resultado con filas manuales históricas ni ofrecer captura desde la pantalla de consulta.

## Exportaciones y reportes

Actualmente se generan en el navegador con ExcelJS y jsPDF/autoTable, a partir de una copia de **todos** los registros filtrados, antes de la paginación visual. Fechas del XLSX: valores de fecha con formato `dd/mm/yyyy`; horas, litros y rendimientos: números, y `Pendiente` para los valores ausentes. Ambos formatos incluyen unidades, periodo, filtros activos, generación, estados pendientes y totales generales/por equipo.

Al añadir paginación de servidor, implementar reportes sobre una revisión/snapshot y los mismos filtros: fechas operativas inclusivas, ID de maquinaria, operador y búsqueda combinados con AND. No exportar solo la página descargada ni reconsultar sin revisión durante el reporte. El servidor deberá autorizar también los reportes, aplicar límites, no exponer credenciales ni auditoría ajena y devolver un error claro si no hay resultados.

## Asignaciones y movimientos de operadores

Se agrega `datos.asignacionesOperadores` al contrato de `GET /operaciones/snapshot`. El frontend acepta su ausencia en datos antiguos y no inventa movimientos iniciales; un backend nuevo debe devolver el arreglo completo de asignaciones bajo la misma revisión del resto de datos. No se agrega otra opción de navegación ni un módulo de captura en Control Diario.

### POST `/asignaciones-operadores/cambios`

Solo administrador o capturista con escritura en Horómetros. Invitados y cuentas sin ese permiso: `403`. Aplicar la misma sesión real, validación y `If-Match` de las operaciones existentes; `X-Usuario-Demo` sigue siendo exclusivamente un identificador demostrativo, no autenticación.

Solicitud (nombres ficticios):

```json
{
  "maquinariaId": "maq-1",
  "operadorNuevo": "Operador Dos",
  "inicio": "2026-11-06T14:00:00Z",
  "motivo": "Cambio de turno",
  "asignacionAnteriorId": "asig-1"
}
```

Para la primera asignación explícita, `asignacionAnteriorId` debe ser `null`. Para un cambio, debe coincidir con el ID vigente que el formulario conocía al abrirse. No aceptar una actualización silenciosa de una asignación distinta. Si no coincide, responder conflicto sin modificar periodos. `operadorNuevo` y `motivo` son textos obligatorios, recortados y de máximo 120 caracteres. El ID de maquinaria debe existir. `inicio` es ISO 8601 con zona, entre los años 2000 y 2100, no futuro; confirmar la política de programación futura antes de ampliarla.

Respuesta `200` para cambio o `201` para primera asignación:

```json
{
  "revision": "\"rev-43\"",
  "asignacionesOperadores": [
    {
      "id": "asig-1",
      "maquinariaId": "maq-1",
      "operador": "Operador Uno",
      "inicio": "2026-11-05T14:00:00Z",
      "fin": "2026-11-06T14:00:00Z",
      "asignacionAnteriorId": null,
      "motivo": "Primera asignación confirmada",
      "registradoEn": "2026-11-05T14:05:00Z",
      "usuarioResponsableId": "usr-ana",
      "usuarioResponsableNombre": "Ana Martínez",
      "cierre": {
        "motivo": "Cambio de turno",
        "registradoEn": "2026-11-06T14:02:00Z",
        "usuarioResponsableId": "usr-lucia",
        "usuarioResponsableNombre": "Lucía Hernández"
      }
    },
    {
      "id": "asig-2",
      "maquinariaId": "maq-1",
      "operador": "Operador Dos",
      "inicio": "2026-11-06T14:00:00Z",
      "fin": null,
      "asignacionAnteriorId": "asig-1",
      "motivo": "Cambio de turno",
      "registradoEn": "2026-11-06T14:02:00Z",
      "usuarioResponsableId": "usr-lucia",
      "usuarioResponsableNombre": "Lucía Hernández"
    }
  ]
}
```

La respuesta contiene **toda la colección actualizada de asignaciones**, no solo los dos periodos afectados, bajo la revisión devuelta. El servidor debe preservar los IDs y metadatos de apertura anteriores y añadir al periodo cerrado `fin` y `cierre` con su motivo, instante de registro y usuario responsable. `registradoEn` es el momento en que se capturó el movimiento; `inicio/fin` son sus fechas efectivas y pueden ser anteriores. El actor debe derivarse de la sesión, nunca del nombre del operador ni de campos arbitrarios enviados por el cliente.

Reglas transaccionales del backend:

- Bloquear o comprobar la revisión y la asignación vigente esperada antes de escribir; validar y cerrar la anterior e insertar la nueva dentro de la misma transacción. Ante cualquier error, no aplicar ninguna parte del cambio.
- Intervalos semiabiertos `[inicio, fin)`: el fin anterior coincide con el inicio nuevo. Prohibir duración negativa/cero, superposición por maquinaria, IDs duplicados, referencias anteriores inconsistentes y dos asignaciones vigentes del mismo equipo.
- Prohibir que un mismo operador ocupe simultáneamente equipos incompatibles. La demo compara nombres normalizados (acentos/mayúsculas/espacios); el sistema real deberá usar **IDs estables de operadores** del catálogo, distintos de los usuarios del sistema, para evitar ambigüedad por homónimos. El frontend ya admite `operadorId` opcional; acordar su obligatoriedad y una selección que distinga homónimos.
- El inicio del cambio debe ser posterior al de la vigente. Una asignación inicial no puede invadir periodos ya registrados del equipo o de ese operador. No deducir el supuesto operador anterior desde un horómetro o una carga: sin asignaciones previas, la primera se registra explícitamente.
- Mantener inmutables los datos históricos de apertura y la identidad del responsable. No ofrecer eliminación ni edición libre de periodos cerrados en esta demo; la política real de correcciones requerirá eventos auditados adicionales.
- No sustituir `operador` de horómetros, combustible ni resultados históricos de Control Diario al cambiar la asignación vigente. No modificar horas, litros, actividad, auditoría de esas fuentes ni los reportes. Las nuevas capturas pueden vincularse mediante `asignacionId`; conservar también el nombre histórico capturado y confirmar la semántica antes de migrar registros antiguos.
- Devolver `400` por fechas/datos inválidos, `403` por falta de permiso, `409`/`412` por revisión o asignación esperada obsoletas. Aplicar restricciones de concurrencia/integridad también en base de datos; los controles del frontend son demostrativos.

La consulta de movimientos usa la colección de la instantánea. Se ordena por inicio ascendente y muestra operador anterior/nuevo, equipo, inicio/fin, motivo y responsable. El ojo de Horómetros reúne esa consulta y el historial propio de la lectura; su botón independiente de reloj se retiró. La demo no reconstruye movimientos para las lecturas existentes ni inventa horas de asignación ausentes.

## Mantenimiento de maquinaria por horómetro

La programación por fechas queda sustituida por horas acumuladas. `fechaUltimoMantenimiento`, `fechaProximoMantenimiento` y `observacionesMantenimiento` se aceptan como datos legados, sin migrarlos a servicios ni inferir lecturas. Las fechas por sí solas no originan semáforo.

Campos opcionales de maquinaria, incluidos en sus POST/PUT y en el snapshot:

```json
{
  "residenteId": "cat-residente-1",
  "avisoMantenimientoHoras": 200,
  "limiteMantenimientoHoras": 250
}
```

`residenteId` enlaza una entrada de catálogo de tipo `residentes`; vacío/ausente significa sin asignar. Resolver el responsable vigente desde el periodo abierto de la maquinaria; en registros legados sin periodos, usar el catálogo y `ubicacionResidente` cuando exista. Nunca copiarlo desde cargas de combustible. Una entrada inactiva ya asignada sigue siendo consultable, pero no se elige como nueva responsable. Validar la relación en el servidor. Los límites son números positivos hasta 9999999; aviso ≤ límite. Su ausencia usa 200/250 h. Los cambios quedan auditados como edición de maquinaria; no cambian las lecturas ni los servicios anteriores.

### POST `/mantenimientos`

Solo administrador o capturista con escritura en `maquinarias`, usando la sesión real y `If-Match` sobre la revisión global. El adaptador demostrativo mantiene `X-Usuario-Demo` hasta integrar autenticación.

```json
{
  "maquinariaId": "maq-1",
  "fecha": "2026-11-07",
  "lecturaHorometro": 2480,
  "tipoServicio": "Servicio preventivo",
  "observaciones": "Cambio de filtros y lubricación"
}
```

Respuesta `201`: `{ "revision": "\"rev-43\"", "registro": <Mantenimiento> }`. El registro contiene estos datos y la auditoría operativa completa (`id`, creación/modificación y `historial` con evento `Creación`, ID/nombre del responsable, fecha y valores). Las observaciones son opcionales, máximo 500 caracteres; tipo de servicio obligatorio hasta 120. Fecha de calendario 2000–2100, no futura; lectura finita entre 0 y 9999999.

Agregar `datos.mantenimientos` a `GET /operaciones/snapshot`: arreglo completo de servicios bajo la misma revisión. Ausencia válida para instalaciones anteriores; no generar servicios desde las fechas legadas. Un backend nuevo devuelve `[]` si no hay servicios. El registro nuevo se añade a la colección; nunca reemplaza el historial previo ni modifica horas/litros de las fuentes. No hay edición ni eliminación de servicios en esta entrega. Consultas e historial se resuelven con el snapshot; no se requiere otro GET de servicios para el cliente actual.

Validaciones transaccionales:

- Maquinaria existente y no eliminada, con autorización de escritura del módulo. El estado operativo no impide registrar un servicio. Validar la revisión antes de insertar y generar auditoría desde la sesión.
- Horómetro actual: última lectura acumulativa válida, usando la base si no hay lecturas. Rechazar intervalos invertidos, no finitos, superpuestos o regresiones respecto de la base/lecturas anteriores. No sumar horas diarias a una lectura acumulativa.
- Lectura del servicio ≤ lectura actual; el nuevo servicio no puede anteceder a la fecha/lectura de la referencia vigente. Debe ser consistente con las lecturas de fechas anteriores/posteriores. Dentro de un día, sin hora de servicio, no inferir un orden más preciso.
- Rechazar duplicado de maquinaria/fecha/lectura/tipo de servicio normalizado. Acordar idempotencia por solicitud para recuperar respuestas perdidas sin insertar otra vez.
- Conservar IDs y auditoría de todos los servicios. La referencia vigente es el servicio de fecha más reciente; dentro del mismo día, lectura mayor y luego instante de creación. Permitir futuras correcciones solo mediante una política auditada acordada.

Semáforo: `horasDesdeServicio = horometroActual - lecturaHorometroServicio`. Con los valores iniciales: verde < 200, amarillo 200–250 inclusive, rojo > 250. Para otros límites se aplica la misma comparación. Sin referencia: `Sin programación`; ante regresión, lectura inválida o referencia superior a la actual: `Revisar horómetro`, sin horas calculadas. Fechas de próximos servicios no intervienen.

Reinicios/sustituciones de contador requieren un contrato futuro de ciclos, lectura de cierre/apertura y conciliación autorizada. El frontend actual no suma contadores de ciclos diferentes ni permite establecer un servicio sobre lecturas inconsistentes; conserva el historial y solicita revisión. No asumir que aumentar la base corrige un reinicio.

Errores: 400/422 validación, 401/403 sesión/permisos, 404 maquinaria inexistente, 409 servicio duplicado o secuencia incompatible, 412 revisión obsoleta. Mantener el sobre de error acordado. Las escrituras inválidas no deben modificar ni la revisión ni los servicios.

### Movimientos de operadores en Maquinarias

El modal Ver reutiliza `asignacionesOperadores` y `POST /asignaciones-operadores/cambios` ya documentados, con permiso de Horómetros para registrar cambios. No se agrega otra colección ni otro endpoint de movimientos. Consultar operador vigente o en un instante por `inicio ≤ instante < fin` (fin nulo abierto). La consulta por fecha/hora usa la zona del dispositivo hasta acordar la zona operativa. Conservar periodos, motivos, apertura/cierre y responsables; sin periodo registrado mostrar `Sin asignar`, sin deducir movimientos desde nombres de lecturas/cargas.

### Compatibilidad de responsables de combustible

`ingeniero` deja de formar parte del contrato de captura, edición y consulta. Usar `nombreResidente` y `pkResidente`. Al leer registros anteriores, el frontend migra el antiguo nombre de ingeniero únicamente si residente está ausente o vacío. Conserva el valor original en `responsableLegado` (cadena opcional de compatibilidad, sin captura ni columna), incluso cuando ya existe otro residente. No modifica los eventos de auditoría anteriores. El backend deberá aplicar la misma migración sin sobrescribir residentes ni perder referencias históricas. Las cantidades, operadores y consolidación no cambian.

## Catálogos iniciales y captura asistida

La interfaz mantiene cuatro pantallas. Los catálogos se completan desde los formularios según permisos. Se conservan componentes internos para administración/importación de catálogos reales, actualmente sin acceso desde el perfil; no son controles de carga de muestras. La maquinaria conserva su CRUD actual. Invitados y capturistas no modifican catálogos, pero pueden consultar sus opciones durante la captura según sus permisos. No se agrega servidor ni base de datos.

### Modelos y relaciones

| Entidad                 | Identificador / relación                                      | Datos                                                                                                                                                                                |
| ----------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Maquinaria              | `id` estable, `numeroEconomico` único                         | Tipo, placas, marca, modelo, estado y horómetro base; mantenimiento opcional ya documentado                                                                                          |
| Entrada de catálogo     | `id` estable; único `(tipo, codigo)`                          | `tipo`: operadores, residentes, despachadores o frentes; nombre, PK opcional y activo                                                                                                |
| Asignación              | `id`, `maquinariaId`, `operadorId` opcional en datos antiguos | Nombre histórico del operador, inicio/fin, motivo, responsable y cierre                                                                                                              |
| Horómetro               | `id`, `maquinariaId`                                          | Fecha operativa, lecturas, operador histórico, periodo de asignación, actividad; referencias opcionales `operadorId`, `asignacionId`, `frenteId`                                     |
| Suministro              | `id`, `maquinariaId`                                          | Fecha/hora, cantidades, combustible, operador, residente/PK, orquesta y despachador; referencias opcionales `operadorId`, `asignacionId`, `residenteId`, `despachadorId`, `frenteId` |
| Importación de catálogo | Huella SHA-256 del archivo                                    | Nombre de archivo, fecha y usuario responsable                                                                                                                                       |
| Usuario y auditoría     | IDs del servidor                                              | Mantener contratos de autenticación, autorización y auditoría ya descritos                                                                                                           |

Los nombres en operaciones y asignaciones son **instantáneas históricas**, no un catálogo alternativo. Cambiar un nombre o PK del catálogo no debe modificar registros anteriores. Las referencias son opcionales para compatibilidad con datos locales previos y capturas de nombres todavía no catalogados. El backend deberá resolver las referencias explícitas y definir cuándo hacerlas obligatorias; no enlazar automáticamente registros históricos por coincidencia de nombres. Los catálogos iniciales reutilizan nombres únicos de registros locales; esto no crea movimientos de operadores ni eventos de auditoría ficticios.

El snapshot `/operaciones/snapshot` puede incluir `catalogos` e `importacionesCatalogos`:

```json
{
  "catalogos": [
    {
      "id": "cat-operador-1",
      "tipo": "operadores",
      "codigo": "OP-001",
      "nombre": "José Luis García",
      "pk": "",
      "activo": true,
      "creadoEn": "2026-11-06T08:00:00-06:00",
      "creadoPor": "Ana Martínez",
      "modificadoEn": "2026-11-06T08:00:00-06:00",
      "modificadoPor": "Ana Martínez",
      "historial": []
    }
  ],
  "importacionesCatalogos": []
}
```

La ausencia de ambas propiedades sigue siendo válida en almacenamiento anterior. La demostración genera opciones de catálogo al leerlas y las conserva en la siguiente escritura. Una cuenta inactiva y una entrada de catálogo inactiva son entidades diferentes.

### Contrato implementado de carga y mantenimiento de catálogos

`Repositorio.guardarCatalogos(carga, usuario, base): Promise<BaseDatos>` permite cambiar entre almacenamiento local y REST sin modificar componentes.

`POST /catalogos/cargas`, con `If-Match: <revision>` y el encabezado demostrativo existente de usuario. Solicitud:

```json
{
  "maquinarias": [
    {
      "numeroEconomico": "EXC-100",
      "placas": "NL-100",
      "tipo": "Excavadora",
      "marca": "Caterpillar",
      "modelo": "320",
      "estado": "Operativa",
      "horometroBase": 0
    }
  ],
  "entradas": [
    {
      "tipo": "residentes",
      "codigo": "RES-001",
      "nombre": "Adriana Salazar",
      "pk": "012+350",
      "activo": true
    }
  ],
  "reemplazar": false,
  "importacion": {
    "huella": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    "nombreArchivo": "catalogos.xlsx"
  }
}
```

Respuesta: `{ "revision": "nueva-revision", "datos": <BaseDatos completo y consistente> }`. `importacion` se omite en altas o ediciones manuales. El backend debe validar todos los registros y permisos antes de aplicar una transacción atómica. Códigos de respuesta previstos: 400/422 validación, 401/403 acceso, 409 duplicidad/importación repetida, 412 revisión desactualizada. El ID de cada entidad existente se conserva; `reemplazar: false` omite identificadores existentes y `true` exige confirmación explícita en la interfaz. La huella evita repetir el mismo archivo, no es una medida de seguridad. La unicidad y la idempotencia definitivas deben imponerse en base de datos.

### Plantilla y validación Excel

- Hojas reconocidas: `Maquinarias`, `Operadores`, `Residentes`, `Despachadores`, `Frentes`.
- Maquinarias: encabezados `numeroEconomico`, `placas`, `tipo`, `marca`, `modelo` obligatorios; opcionales `estado`, `horometroBase`, `fechaUltimoMantenimiento`, `fechaProximoMantenimiento`, `observacionesMantenimiento`.
- Otras hojas: `codigo`, `nombre` obligatorios; `pk`, `activo` opcionales. Guardar identificadores como texto para conservar ceros iniciales. `activo` usa true/false; las fechas usan YYYY-MM-DD o celdas de fecha.
- Máximo 5 MB y 1000 registros totales por archivo. Solo valores simples; fórmulas, hipervínculos, encabezados desconocidos y duplicados dentro del archivo bloquean la carga completa. No se importan operaciones diarias, asignaciones ni auditoría.
- Vista previa sin escrituras; confirmación de la carga y, por separado, de reemplazos. Los campos opcionales ausentes en maquinaria existente conservan el dato; los datos explícitos del archivo pueden cambiarlo tras confirmar.

### Reglas de captura y consulta

La fecha operativa es una fecha de calendario local, no un instante UTC. El backend deberá fijar la zona operativa común. El frontend usa hoy por defecto, permite fechas anteriores y rechaza fechas futuras al guardar. Busca la última lectura no eliminada del mismo equipo hasta la fecha seleccionada, incluyendo intervalos anteriores del mismo día. Sin historial, el horómetro base es una referencia: la primera lectura requiere administrador y `capturaInicialSupervisada: "Confirmada por administrador"`. El backend deberá comprobar esta autorización con la sesión real.

Las nuevas capturas utilizan la asignación de ese periodo; Combustible también considera la hora de carga. Si un día tiene varias asignaciones y no hay hora que las distinga, Horómetros exige identificar al operador histórico. Un cambio de asignación cierra el periodo anterior sin sustituir nombres de operaciones previas. Las lecturas exactamente duplicadas, superpuestas o cronológicamente inconsistentes se rechazan; varias cargas por equipo y día conservan IDs independientes. No existe una restricción única por equipo/día para suministros.

Control Diario sigue derivándose únicamente de fuentes por `(maquinariaId, fecha)`, con agregación independiente de horas y litros. Sus filtros y exportaciones usan todos los resultados filtrados, no solo la página. Los totales calculan rendimientos a partir de sumas válidas; no promedian filas. Las consultas compactas integran metadatos y auditoría en apartados desplegables.

Cuando no existe una asignación conocida, `fechaAsignacion` en nuevas lecturas puede ser una cadena vacía; la interfaz no inventa una fecha. El valor previo se conserva al editar. Las referencias de asignación se conservan al editar otros campos y se reevalúan si cambia equipo, fecha, operador u hora.


## Compatibilidad y límites del adaptador

- Los formularios vigentes de Horómetros y Combustible retiraron la captura de actividad/frente. Se conservan los campos históricos al editar; Control Diario sigue siendo de consulta.
- La carga inicial no es un cierre definitivo de incorporación: se bloquea la misma huella de archivo y se omiten identificadores existentes salvo reemplazo confirmado. Se permiten nuevos archivos y mantenimiento manual de catálogos. Si negocio exige una única carga global, acordar un estado de cierre, autorización para reapertura y validación transaccional; no existe ese estado en la demo.
- El repositorio local crea una base vacía al faltar almacenamiento; no existe generación automática de muestras operativas; las cuentas temporales solo se preparan en desarrollo local conforme al apartado de entrega. En REST tampoco se generan datos de demostración. La consulta inicial se comparte durante la repetición de efectos de StrictMode; recargar o iniciar otra sesión vuelve a consultar explícitamente.
- Las fechas y observaciones legadas se conservan en maquinaria. La ampliación por horas agrega la colección `mantenimientos` y el endpoint documentado arriba; no incluye refacciones, costos ni órdenes de mantenimiento.
- El adaptador comprueba el ID de respuestas de escritura antes de actualizar su revisión: PUT/DELETE deben conservar el solicitado y POST debe devolver uno nuevo. La instantánea aún valida formatos, pero no comprueba globalmente IDs duplicados ni todas las referencias cruzadas: el servidor debe garantizar unicidad e integridad.
- Los errores 409 y 412 muestran hoy el mismo mensaje de concurrencia, aunque un 409 también puede representar duplicidad. Acordar códigos de error estables y validarlos en el adaptador antes de presentar mensajes o errores por campo. Para timeout o pérdida de conexión tras una escritura, recargar antes de repetir; no existe clave de idempotencia de solicitudes. Acordarla especialmente para suministros, donde varias cargas idénticas pueden ser legítimas.
- Los límites numéricos actuales son de 0 a 9999999 y los controles proponen pasos de 0.01, pero no imponen escala decimal en el modelo. Acordar precisión, redondeo y zona operativa común antes de persistir valores reales.
- El snapshot completo y los historiales residen en memoria; no hay paginación ni exportación en servidor. La auditoría administrativa de cuentas y su integración REST siguen pendientes. La integración necesita trabajo tanto en el backend como en los adaptadores del frontend.


## Periodos históricos de residentes en Maquinarias

Maquinaria puede devolver `periodosResidentes` (ausente en registros anteriores). Cada periodo conserva una instantánea de nombre y PK para evitar que una edición posterior del catálogo altere el pasado:

```json
{
  "periodosResidentes": [
    {
      "id": "res-periodo-1",
      "residenteId": "cat-residente-1",
      "nombre": "Adriana Salazar",
      "pk": "012+350",
      "inicio": "2026-11-07T15:00:00Z",
      "fin": null,
      "motivo": "Asignación confirmada",
      "registradoEn": "2026-11-07T15:00:00Z",
      "usuarioId": "usr-ana",
      "usuarioNombre": "Ana Martínez"
    }
  ]
}
```

Un cierre añade `fin` y `cierre: {motivo, registradoEn, usuarioId, usuarioNombre}`. Intervalos semiabiertos `[inicio, fin)`, sin superposiciones, IDs repetidos ni dos periodos abiertos. `fin` debe ser posterior al inicio y corresponder a la presencia de `cierre`.

Se mantienen los endpoints de maquinaria: POST/PUT reciben `residenteId` y, opcionalmente, `motivoCambioResidente` (texto recortado, hasta 120 caracteres). Al cambiar residente, el servidor cierra el periodo conocido y abre el nuevo en la misma transacción de la actualización y su auditoría. El formulario permite una fecha de inicio no futura (`referencias.fechaInicioResidente`, día local). Los cambios deben ser posteriores al inicio vigente y no solaparse; para cambios del mismo día se conserva el instante efectivo registrado. Vaciar residente cierra el periodo sin crear una persona ficticia. Sin motivo explícito nuevo, el cambio desde Editar utiliza «Actualización del residente responsable».

Si el registro legado ya tiene residente pero ningún periodo, una edición de otros campos no crea historia. El modal permite confirmar la asignación actual con un motivo nuevo: eso abre el primer periodo desde la fecha confirmada expresamente, sin reconstruir movimientos previos. Si el nombre o PK catalogado cambió, una confirmación explícita puede cerrar el periodo anterior y abrir otro con la nueva instantánea. Editar el catálogo por sí solo no reescribe periodos.

La demo genera esta estructura en el repositorio local. En REST el servidor debe generar los periodos y devolver la maquinaria completa con ellos en `{revision, registro}`. El adaptador puede enviar los periodos previos como parte del modelo de maquinaria: ignorarlos como órdenes de modificación, comprobar la versión y preservar la colección autoritativa. No confiar en IDs, nombres, fechas ni responsables arbitrarios del cliente. Aplicar la misma política a cargas de catálogo que actualicen maquinaria; no permitir borrar el historial al sustituir datos generales.

Mantener permiso de escritura de Maquinarias, revisión `If-Match`, integridad del catálogo residente y auditoría. Los operadores siguen usando sus asignaciones existentes; el modal solo compone las fuentes de historial y servicios para presentarlas, sin persistir copias de los eventos. Los nombres/PK de periodos son instantáneas históricas intencionales, no un catálogo adicional.

## Consulta y reportes de Control Diario: periodos y totales

El frontend inicia y limpia con el día local del dispositivo. `FiltrosControl` conserva `busqueda`, `maquinaria` (ID), `operador`, `desde` y `hasta`; las fechas son días locales `YYYY-MM-DD` inclusivos. Fechas vacías significan límites abiertos; ambas vacías equivalen a Todas las fechas. Rechazar `desde > hasta`. Últimos 7 días incluye hoy y los seis días anteriores; Este mes abarca el primer día hasta hoy.

Los servicios puros de filtros, totales y reportes usan el mismo conjunto consolidado completo. El resumen único cuenta maquinarias distintas, suma horas y litros disponibles y calcula L/h como suma de litros / suma de horas de los mismos registros con ambas fuentes válidas y positivas. Las filas incompletas o con cero conservan rendimiento nulo; se excluyen del cociente, sin extrapolar ni promediar rendimientos. h/L utiliza los mismos pares. Excel contiene una sola hoja de 11 columnas y una tabla principal con TOTAL GENERAL; no genera una segunda tabla Resumen por maquinaria. PDF conserva una sola tabla principal y el resumen textual de indicadores.

El posible `GET /control-diario/consolidado` descrito anteriormente deberá respetar estas reglas. Si el backend pagina, sus totales y exportaciones deben cubrir todos los resultados filtrados bajo la misma revisión. No limitar los archivos a la página visible. Mantener consulta y exportación para los roles autorizados y rechazar reportes sin resultados. No se implementa este endpoint en esta entrega: el adaptador actual sigue cargando el snapshot de fuentes y consolidando en el frontend.


## Entrega, desarrollo local y producción

El código vive en `frontend/`; ejecutar comandos desde esa carpeta. `frontend/.env.example` conserva `VITE_API_URL`. Los datos sintéticos están aislados en `frontend/pruebas/datos/` y no se importan desde código operativo.

El estado operativo nuevo está vacío. Solo Vite de desarrollo local, con API vacía y fuera del modo de pruebas, configura dos administradores temporales (`admin1` y `admin2`) en `marimba.usuarios.desarrollo.v1`. Las credenciales temporales y su inicializador se excluyen del build de producción mediante importación condicional de desarrollo. No se muestran en el login ni se almacenan en texto plano. No constituyen identidad o seguridad de servidor.

La limpieza local se conserva como utilidad explícita y no se ejecuta al iniciar. No modifica API ni datos remotos y no hay carga automática de muestras.

La producción no crea administradores predeterminados. Implementar un adaptador de `ServicioAcceso` y conectarlo en `ProveedorSesion`, con provisión segura del primer administrador y las sesiones/usuarios descritos arriba. No migrar derivados PBKDF2 locales ni aceptar `X-Usuario-Demo` como autenticación. Configurar la URL solo conecta operaciones; no implementa identidad.

Excel conserva una hoja, una tabla y 11 columnas. PDF conserva una tabla principal de 10 columnas y resumen textual. Ambos usan el conjunto filtrado completo y totales ponderados, sin duplicar fuentes por maquinaria/fecha. Sin parámetros válidos no se clasifican consumos o jornadas. Los estados operativos/mantenimiento exportados son los actuales.

El backend debe hacer transaccionales las fuentes con catálogos y auditoría, cambios de operador/residente, servicios, bajas y cargas. Debe imponer unicidad, integridad por ID, autorización, fecha/autor de servidor, precisión, zona operativa y revisión. Acordar idempotencia, errores por campo y reportes sobre una instantánea si se agrega paginación. No se implementa backend ni base de datos en esta entrega.


## Parámetros técnicos y alertas de maquinaria

Extensión opcional del modelo de maquinaria, sin cambiar rutas ni relaciones existentes:

| Campo | Validación / significado |
| --- | --- |
| `consumoMinimoEsperado` | L/h no negativo, no superior a `consumoNormalMaximo`; límite inferior trabajando |
| `consumoAdvertenciaMinimo` | L/h no negativo, requiere mínimo y no debe superarlo; consumo bajo siempre requiere revisión, nunca se vuelve crítico automáticamente |
| `consumoNormalMaximo` | Máximo esperado trabajando, positivo |
| `consumoAdvertenciaMaximo` | Umbral superior crítico, mayor que el máximo normal |
| `horasMinimasDiarias` | Horas esperadas por día con operaciones, mayor que 0 y hasta 24; sin calendario laboral implícito |
| `consumoRalentiMinimo`, `consumoRalentiMaximo` | Pareja opcional ordenada (mínimo no negativo, máximo positivo); no se deducen desde el rango trabajando |
| `consumoRalentiAdvertenciaMaximo` | Opcional, mayor que el máximo en ralentí; sin él el exceso en ralentí requiere revisión |
| `referenciaConsumo`, `validadoConsumoPor`, `fechaValidacionConsumo` | Fuente/criterio autorizado, responsable y fecha no futura; obligatorios al configurar parámetros técnicos |

Tipo y modelo se editan en Datos de Maquinarias y se muestran en Consumo. Los parámetros no tienen valores de fabricante predeterminados. Se puede configurar únicamente jornada con su referencia validada, sin inventar límites L/h. La ausencia de límites no equivale a cero.

Horómetro y suministro aceptan `regimenOperacion` opcional: `Trabajo`, `Ralentí`, `Mixto` o cadena vacía (sin identificar). Debe conservarse al guardar, leer y auditar. No cambia las lecturas ni cantidades. Si se configuran rangos distintos de ralentí, solo se comparan fuentes del mismo régimen explícito. Fuentes mezcladas, una fuente sin identificar junto a otra identificada o `Mixto` dejan el consumo Sin evaluar; no se prorratean litros arbitrariamente.

Control Diario continúa derivado por maquinaria/fecha, sin escrituras independientes. Suma cada lectura y carga activa una sola vez; valida continuidad acumulada desde el horómetro base, diferencias individuales y suma diaria de hasta 24 h. Lecturas inválidas, discontinuas o cargas inválidas impiden la evaluación técnica. El cociente observado de litros suministrados/hora no demuestra consumo efectivo del tanque ni uso indebido.

La evaluación derivada `evaluacion: {nivel, motivos, rango}` no se persiste como nueva entidad. Niveles compartidos por interfaz y exportaciones:

- **Normal** (verde): datos comparables y consumo dentro del rango, sin incidencias ni baja actividad configurada.
- **Revisar** (amarillo): fuera de rango sin superar el umbral crítico; consumo bajo; combustible sin horas válidas; fuentes incompletas o inconsistentes; horas por debajo de la jornada validada.
- **Crítica** (rojo): consumo comparable superior al umbral superior crítico configurado. No se acusa uso indebido.
- **Sin evaluar** (gris): parámetros, fuentes o régimen insuficientes para evaluar, sin otra incidencia comprobada.

En los límites exactos se mantiene la categoría inferior. El resumen compacto cuenta equipos distintos por su mayor nivel en el conjunto filtrado (Crítica > Revisar > Sin evaluar > Normal); el detalle conserva cada fecha. Solo se evalúan días con fuentes registradas: no se inventa actividad en días ausentes. Operadores se filtran desde los registros históricos. Alertas y actividad dependen del periodo seleccionado; mantenimiento y estado operativo se identifican como actuales.

### Responsable visible y trazabilidad

Maquinarias, Combustible y Control Diario muestran un único residente/PK **vigente**, resuelto por ID de maquinaria. La regla es el periodo abierto; ante datos legados con varios abiertos se elige el inicio más reciente y, en empate, ID ascendente para una presentación determinista. El servidor debe rechazar esta inconsistencia. Sin periodo abierto se usa la referencia vigente explícita de maquinaria/catalogo; sin referencia se muestra Sin asignar/Sin registrar, sin deducir responsables desde suministros.

Esta regla no selecciona varios responsables históricos del día ni modifica los nombres/PK ya capturados en combustible. El detalle de suministro identifica expresamente los responsables registrados en esa operación. El historial de asignaciones reside exclusivamente en Ver de Maquinarias. Un cambio de residente o PK actualiza las vistas por la misma fuente; no reescribe periodos cerrados ni operadores históricos.

Excel conserva **una hoja Control Diario, una tabla y 11 columnas**. Residente/PK se exporta como vigente al generar y se identifica en encabezado/filtros y nota; operadores y cifras son del periodo filtrado. La columna existente de consumo incorpora nivel y estado, color compartido y motivos en nota. PDF conserva una tabla principal, el mismo nivel y motivo relevante compacto. Ambos reciben todos los resultados filtrados antes de paginar y los mismos totales. No se convierten parámetros ausentes en valores o clasificaciones inventados.

### Próximo mantenimiento y transacciones

La referencia es el último servicio activo. `horometroObjetivo = lecturaHorometroServicio + limiteMantenimientoHoras`; las horas restantes son `max(0, objetivo - actual)` y el exceso se identifica como vencido. El progreso se limita a 0–100 %. Sin referencia suficiente no se calcula objetivo/progreso; con inconsistencia se indica Revisar horómetro. El semáforo usa horas acumuladas válidas, no solo el último día, y es independiente del estado operativo. Registrar un servicio añade un evento y cambia la referencia derivada, conservando todos los servicios previos.

El backend deberá persistir los nuevos parámetros y régimen sin descartarlos, auditar sus cambios y aplicar los mismos permisos. Mantener atómicas la escritura de maquinaria con catálogo/periodo de residente, cambios de operador, servicio con auditoría y revisión de snapshot, y capturas/bajas con validación de continuidad y catálogos. El servidor debe imponer `If-Match`, IDs, no solapamiento, política de zona horaria y errores de dominio; una respuesta inválida no autoriza mutaciones parciales. No se añaden endpoints, backend ni base de datos en esta entrega.

import type { CellValue } from 'exceljs';
import type { BaseDatos } from '../../tipos/datos';
import type { VistaImportacion, TipoCatalogo } from '../tipos/catalogo';
import { esquemaEntradaCatalogo } from '../validaciones/catalogo';
import { esquemaMaquinaria } from '../../../modulos/maquinarias/validaciones/maquinaria';
import { claveCatalogo } from './catalogos';
const hojas: Record<string, TipoCatalogo> = {
  Operadores: 'operadores',
  Residentes: 'residentes',
  Despachadores: 'despachadores',
  Frentes: 'frentes',
};
const encabezadosMaquinaria = [
  'numeroEconomico',
  'placas',
  'tipo',
  'marca',
  'modelo',
  'estado',
  'horometroBase',
  'fechaUltimoMantenimiento',
  'fechaProximoMantenimiento',
  'observacionesMantenimiento',
];
const encabezadosPersona = ['codigo', 'nombre', 'pk', 'activo'];
function valorCelda(valor: CellValue): string | number | boolean {
  if (valor === null || valor === undefined) return '';
  if (valor instanceof Date) return valor.toISOString().slice(0, 10);
  if (typeof valor === 'object')
    throw new Error('No se admiten fórmulas, enlaces ni celdas enriquecidas. Usa valores simples.');
  return typeof valor === 'string' ? valor.trim() : valor;
}
export async function leerExcelCatalogos(
  datos: ArrayBuffer,
  nombreArchivo: string,
  base: BaseDatos,
): Promise<VistaImportacion> {
  if (!nombreArchivo.toLowerCase().endsWith('.xlsx'))
    throw new Error('Selecciona un archivo .xlsx.');
  if (datos.byteLength > 5 * 1024 * 1024) throw new Error('El archivo no puede superar 5 MB.');
  const { Workbook } = await import('exceljs');
  const libro = new Workbook();
  await libro.xlsx.load(datos);
  const digest = await crypto.subtle.digest('SHA-256', datos);
  const huella = [...new Uint8Array(digest)]
    .map((valor) => valor.toString(16).padStart(2, '0'))
    .join('');
  if (base.importacionesCatalogos?.some((registro) => registro.huella === huella))
    throw new Error('Este archivo ya fue importado.');
  const resultado: VistaImportacion = {
    carga: {
      maquinarias: [],
      entradas: [],
      reemplazar: false,
      importacion: { huella, nombreArchivo },
    },
    filas: [],
  };
  const vistos = new Set<string>();
  let contador = 0;
  for (const hoja of libro.worksheets) {
    if (hoja.name !== 'Maquinarias' && !hojas[hoja.name]) {
      if (hoja.actualRowCount > 1)
        throw new Error(`Hoja no reconocida: ${hoja.name}. Descarga la plantilla.`);
      continue;
    }
    if (hoja.rowCount > 1001 || hoja.columnCount > 20)
      throw new Error('Máximo 1000 filas por hoja y 20 columnas.');
    const encabezados: string[] = [];
    hoja.getRow(1).eachCell((celda, columna) => {
      encabezados[columna] = String(valorCelda(celda.value));
    });
    const permitidos = hoja.name === 'Maquinarias' ? encabezadosMaquinaria : encabezadosPersona;
    if (
      new Set(encabezados.filter(Boolean)).size !== encabezados.filter(Boolean).length ||
      encabezados.some((campo) => campo && !permitidos.includes(campo))
    )
      throw new Error(
        `Encabezados inválidos en ${hoja.name}. Usa la plantilla sin modificar los encabezados.`,
      );
    const requeridos =
      hoja.name === 'Maquinarias' ? encabezadosMaquinaria.slice(0, 5) : ['codigo', 'nombre'];
    if (requeridos.some((campo) => !encabezados.includes(campo)))
      throw new Error(`Faltan encabezados obligatorios en ${hoja.name}: ${requeridos.join(', ')}.`);
    for (let numeroFila = 2; numeroFila <= hoja.rowCount; numeroFila++) {
      const fila = hoja.getRow(numeroFila);
      if (!fila.hasValues) continue;
      if (++contador > 1000) throw new Error('La carga completa admite hasta 1000 registros.');
      const valores: Record<string, string | number | boolean> = {};
      const errores: string[] = [];
      encabezados.forEach((campo, indice) => {
        if (!campo) return;
        try {
          const valor = valorCelda(fila.getCell(indice).value);
          if (valor !== '') valores[campo] = valor;
        } catch (error) {
          errores.push(error instanceof Error ? error.message : 'Celda inválida.');
        }
      });
      const esMaquinaria = hoja.name === 'Maquinarias';
      const identificador = String(
        valores[esMaquinaria ? 'numeroEconomico' : 'codigo'] ?? '',
      ).toUpperCase();
      const clave = claveCatalogo(esMaquinaria ? 'maquinarias' : hojas[hoja.name], identificador);
      if (vistos.has(clave)) errores.push('Identificador duplicado dentro del archivo.');
      vistos.add(clave);
      const existente = esMaquinaria
        ? base.maquinarias.some(
            (equipo) => claveCatalogo('maquinarias', equipo.numeroEconomico) === clave,
          )
        : (base.catalogos ?? []).some(
            (entrada) => claveCatalogo(entrada.tipo, entrada.codigo) === clave,
          );
      if (esMaquinaria) {
        const anterior = base.maquinarias.find(
          (equipo) => claveCatalogo('maquinarias', equipo.numeroEconomico) === clave,
        );
        const validacion = esquemaMaquinaria.safeParse({
          estado: anterior?.estado ?? 'Operativa',
          horometroBase: anterior?.horometroBase ?? 0,
          ...valores,
        });
        if (!validacion.success)
          errores.push(
            ...validacion.error.issues.map((error) => `${error.path.join('.')}: ${error.message}`),
          );
        else resultado.carga.maquinarias.push(validacion.data);
      } else {
        const activo =
          valores.activo === undefined
            ? true
            : valores.activo === true ||
              valores.activo === 1 ||
              String(valores.activo).toLowerCase() === 'true' ||
              String(valores.activo).toLowerCase() === 'sí';
        if (
          valores.activo !== undefined &&
          ![true, false, 1, 0, 'true', 'false', 'sí', 'no'].includes(valores.activo)
        )
          errores.push('activo: usa true o false.');
        const validacion = esquemaEntradaCatalogo.safeParse({
          ...valores,
          tipo: hojas[hoja.name],
          activo,
        });
        if (!validacion.success)
          errores.push(
            ...validacion.error.issues.map((error) => `${error.path.join('.')}: ${error.message}`),
          );
        else resultado.carga.entradas.push(validacion.data);
      }
      resultado.filas.push({
        hoja: hoja.name,
        fila: numeroFila,
        identificador,
        nombre: String(valores.nombre ?? valores.tipo ?? ''),
        existente,
        errores,
        datos: valores,
      });
    }
  }
  if (!resultado.filas.length) throw new Error('El archivo no contiene registros.');
  return resultado;
}
export async function crearPlantillaCatalogos(): Promise<Uint8Array> {
  const { Workbook } = await import('exceljs');
  const libro = new Workbook();
  for (const nombre of ['Maquinarias', ...Object.keys(hojas)]) {
    const hoja = libro.addWorksheet(nombre);
    const encabezados = nombre === 'Maquinarias' ? encabezadosMaquinaria : encabezadosPersona;
    hoja.columns = encabezados.map((header) => ({ header, key: header, width: 26 }));
    hoja.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    hoja.getRow(1).eachCell((celda) => {
      celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF14263D' } };
    });
    hoja.views = [{ state: 'frozen', ySplit: 1 }];
    hoja.autoFilter = { from: 'A1', to: `${String.fromCharCode(64 + encabezados.length)}1` };
  }
  return new Uint8Array(await libro.xlsx.writeBuffer());
}

import { claveNombreCatalogo } from '../servicios/catalogos';
import type { UseFormRegisterReturn } from 'react-hook-form';
import type { TipoCatalogo } from '../tipos/catalogo';
import { useDatos } from '../../contextos/contexto-datos';
import { puedeAdministrar } from '../../../modulos/acceso/servicios/permisos';
import { catalogosFormulario } from '../servicios/catalogos-formulario';
import { Combobox } from '../../componentes/Combobox';

export function SelectorNombreCatalogo({
  tipo,
  registro,
  invalido = false,
  soloLectura = false,
  valorHistorico,
  valor,
}: {
  tipo: TipoCatalogo;
  registro: UseFormRegisterReturn;
  invalido?: boolean;
  soloLectura?: boolean;
  valorHistorico?: string;
  valor?: string;
}) {
  const { base, usuario } = useDatos();
  const opciones = catalogosFormulario(base)
    .filter((entrada) => entrada.tipo === tipo && entrada.activo)
    .map((entrada) => entrada.nombre);
  if (tipo === 'combustibles') opciones.push('Diésel', 'Gasolina');
  if (valorHistorico) opciones.push(valorHistorico);
  const etiquetas: Record<TipoCatalogo, string> = {
    operadores: 'Operador',
    residentes: 'Residente',
    despachadores: 'Despachador',
    frentes: 'Actividad / Frente',
    tiposMaquinaria: 'Tipo de maquinaria',
    marcas: 'Marca',
    modelos: 'Modelo',
    ubicaciones: 'PK / Ubicación',
    combustibles: 'Tipo de combustible',
  };
  return (
    <Combobox
      {...registro}
      etiqueta={etiquetas[tipo]}
      value={valor}
      claveOpcion={(texto) => claveNombreCatalogo(tipo, texto)}
      conservarTexto={tipo === 'ubicaciones'}
      opciones={opciones}
      permitirNuevo={puedeAdministrar(usuario)}
      readOnly={soloLectura}
      invalido={invalido}
      maxLength={tipo === 'ubicaciones' ? 60 : 120}
      placeholder={soloLectura ? 'Operador asignado' : 'Escribe o selecciona una opción'}
    />
  );
}

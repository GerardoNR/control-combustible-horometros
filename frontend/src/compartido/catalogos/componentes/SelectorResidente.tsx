import { Form } from 'react-bootstrap';
import { Campo } from '../../componentes/FormularioBase';
import { Combobox } from '../../componentes/Combobox';
import { useDatos } from '../../contextos/contexto-datos';
import { puedeAdministrar } from '../../../modulos/acceso/servicios/permisos';
import { catalogosFormulario } from '../servicios/catalogos-formulario';
import { claveNombreCatalogo, normalizarNombre } from '../servicios/catalogos';

export function SelectorResidente({
  nombre,
  pk,
  cambiar,
  referencia,
  id = 'residenteMaquinaria',
}: {
  nombre: string;
  pk: string;
  cambiar: (nombre: string, pk: string) => void;
  id?: string;
  referencia?: { nombre: string; pk?: string };
}) {
  const { base, usuario } = useDatos();
  const catalogos = catalogosFormulario(base);
  const residentes = catalogos.filter((entrada) => entrada.tipo === 'residentes' && entrada.activo);
  const ubicaciones = catalogos
    .filter((entrada) => entrada.tipo === 'ubicaciones' && entrada.activo)
    .map((entrada) => entrada.nombre);
  const permitirNuevo = puedeAdministrar(usuario);
  return (
    <>
      <Campo id={id} etiqueta="Ingeniero residente">
        <Combobox
          name="residenteNombre"
          etiqueta="Ingeniero residente"
          placeholder="Escribe o selecciona una persona"
          value={nombre}
          opciones={residentes.map((entrada) => entrada.nombre)}
          permitirNuevo={permitirNuevo}
          maxLength={120}
          onChange={(evento) => {
            const valor = evento.target.value;
            const residente = residentes.find(
              (entrada) => normalizarNombre(entrada.nombre) === normalizarNombre(valor),
            );
            const sugerido =
              referencia && normalizarNombre(referencia.nombre) === normalizarNombre(valor)
                ? referencia.pk
                : residente?.pk;
            cambiar(
              valor,
              normalizarNombre(valor) === normalizarNombre(nombre) ? pk : (sugerido ?? ''),
            );
          }}
        />
        <Form.Text>
          Si el residente tiene un PK guardado en el catálogo, se completa automáticamente.
        </Form.Text>
      </Campo>
      <Campo id={`${id}Pk`} etiqueta="PK / Ubicación">
        <Combobox
          name="ubicacionResidente"
          etiqueta="PK / Ubicación"
          placeholder="Ejemplo: 012+350"
          value={pk}
          opciones={ubicaciones}
          claveOpcion={(valor) => claveNombreCatalogo('ubicaciones', valor)}
          conservarTexto
          permitirNuevo={permitirNuevo}
          maxLength={60}
          onChange={(evento) => cambiar(nombre, evento.target.value)}
        />
        <Form.Text>
          Tramo o punto de ubicación del equipo; puede ajustarse si es necesario.
        </Form.Text>
      </Campo>
    </>
  );
}

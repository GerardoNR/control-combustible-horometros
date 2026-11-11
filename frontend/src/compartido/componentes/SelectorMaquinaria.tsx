import { Form } from 'react-bootstrap';
import type { UseFormRegisterReturn, FieldError } from 'react-hook-form';
import { useDatos } from '../contextos/contexto-datos';
import { Campo } from './FormularioBase';
export function SelectorMaquinaria({
  deshabilitado = false,
  valor = '',
  registro,
  error,
}: {
  deshabilitado?: boolean;
  valor?: string;
  registro: UseFormRegisterReturn;
  error?: FieldError;
}) {
  const { base } = useDatos();
  return (
    <Campo etiqueta="Maquinaria *" id="maquinariaId" error={error}>
      {deshabilitado ? (
        <>
          <Form.Control
            readOnly
            value={base.maquinarias.find((equipo) => equipo.id === valor)?.numeroEconomico ?? valor}
          />
          <input type="hidden" {...registro} />
        </>
      ) : (
        <Form.Select
          {...registro}
          isInvalid={!!error}
          aria-describedby={error ? 'maquinariaId-error' : undefined}
        >
          <option value="">Selecciona un equipo</option>
          {base.maquinarias.map((equipo) => (
            <option key={equipo.id} value={equipo.id}>
              {equipo.numeroEconomico} · {equipo.tipo}
            </option>
          ))}
        </Form.Select>
      )}
    </Campo>
  );
}

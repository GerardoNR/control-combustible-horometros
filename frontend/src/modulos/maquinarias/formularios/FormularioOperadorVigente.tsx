import { SelectorNombreCatalogo } from '../../../compartido/catalogos/componentes/SelectorNombreCatalogo';
import { useState } from 'react';
import { Form } from 'react-bootstrap';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Campo, FormularioBase } from '../../../compartido/componentes/FormularioBase';
import { useDatos } from '../../../compartido/contextos/contexto-datos';
import { esquemaFormularioCambio } from '../../horometros/validaciones/asignacion-operador';
import { asignacionVigente } from '../../horometros/servicios/asignaciones-operadores';
import { fechaCalendario } from '../../../compartido/utilidades/formato';
import type { DatosFormularioCambio } from '../../horometros/tipos/asignacion-operador';
function fechaLocalActual() {
  const fecha = new Date();
  const local = new Date(fecha.getTime() - fecha.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}
function fechaPosterior(fecha: string) {
  const fechaLocal = new Date(`${fecha}T12:00:00`);
  fechaLocal.setDate(fechaLocal.getDate() + 1);
  return `${fechaLocal.getFullYear()}-${String(fechaLocal.getMonth() + 1).padStart(2, '0')}-${String(fechaLocal.getDate()).padStart(2, '0')}`;
}
function inicioDeAsignacion(fecha: string) {
  const hoy = fechaLocalActual();
  const ahora = new Date();
  const horaLocal = new Date(ahora.getTime() - ahora.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(11, 19);
  return new Date(`${fecha}T${fecha === hoy ? horaLocal : '00:00:00'}`).toISOString();
}
export function FormularioOperadorVigente({
  maquinariaId,
  cancelar,
  exito,
}: {
  maquinariaId: string;
  cancelar: () => void;
  exito: () => void;
}) {
  const { base, cambiarOperador } = useDatos();
  const [anterior] = useState(() =>
    asignacionVigente(base.asignacionesOperadores ?? [], maquinariaId),
  );
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<DatosFormularioCambio>({
    resolver: zodResolver(esquemaFormularioCambio),
    defaultValues: { operadorNuevo: '', inicioLocal: fechaLocalActual(), motivo: '' },
  });
  const cambios = useWatch({ control, name: ['operadorNuevo', 'inicioLocal'] });
  return (
    <div>
      <p className="small text-secondary">
        {anterior
          ? `Operador vigente al abrir el formulario: ${anterior.operador}. Su asignación se cerrará al inicio del cambio.`
          : 'No hay asignación vigente registrada. Se creará la primera, sin reconstruir movimientos anteriores.'}{' '}
        La asignación inicia al comienzo de la fecha seleccionada. Las capturas históricas no se
        modifican.
      </p>
      <FormularioBase
        modulo="maquinarias"
        confirmacion={`Asignar ${cambios[0]} desde el ${cambios[1]} y cerrar el periodo vigente, si existe. Las capturas anteriores conservarán su operador.`}
        etiquetaBoton="Guardar asignación"
        cancelar={cancelar}
        enviar={handleSubmit(async (datos) => {
          await cambiarOperador({
            maquinariaId,
            operadorNuevo: datos.operadorNuevo,
            inicio: inicioDeAsignacion(datos.inicioLocal),
            motivo: datos.motivo,
            asignacionAnteriorId: anterior?.id ?? null,
          });
          exito();
        })}
      >
        <Campo etiqueta="Nuevo operador *" id="operadorNuevo" error={errors.operadorNuevo}>
          <SelectorNombreCatalogo
            tipo="operadores"
            registro={register('operadorNuevo')}
            invalido={!!errors.operadorNuevo}
          />
        </Campo>
        <Campo etiqueta="Fecha de inicio *" id="inicioLocal" error={errors.inicioLocal}>
          <Form.Control
            type="date"
            min={
              anterior
                ? fechaCalendario(new Date(anterior.inicio)) < fechaLocalActual()
                  ? fechaPosterior(fechaCalendario(new Date(anterior.inicio)))
                  : fechaLocalActual()
                : '2000-01-01'
            }
            max={fechaLocalActual()}
            {...register('inicioLocal')}
            isInvalid={!!errors.inicioLocal}
          />
        </Campo>
        <Campo
          etiqueta="Motivo de la asignación o cambio *"
          id="motivo"
          error={errors.motivo}
          ancho
        >
          <Form.Control
            as="textarea"
            rows={2}
            maxLength={120}
            {...register('motivo')}
            isInvalid={!!errors.motivo}
          />
        </Campo>
      </FormularioBase>
    </div>
  );
}

import { Form } from 'react-bootstrap';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Campo, FormularioBase } from '../../../compartido/componentes/FormularioBase';
import { useDatos } from '../../../compartido/contextos/contexto-datos';
import { IntroduccionFormulario } from './IntroduccionFormulario';
import { hoy } from '../../../compartido/utilidades/formato';
import { esquemaMantenimiento } from '../validaciones/mantenimiento';
import { evaluarMantenimiento } from '../servicios/mantenimiento';
import type { DatosMantenimiento } from '../tipos/mantenimiento';
import type { Maquinaria } from '../tipos/maquinaria';
import { FichaMantenimiento } from '../componentes/MantenimientoMaquinaria';
export function FormularioMantenimiento({
  maquinaria,
  terminar,
  exito,
}: {
  maquinaria: Maquinaria;
  terminar: () => void;
  exito: () => void;
}) {
  const { base, registrarMantenimiento } = useDatos();
  const resumen = evaluarMantenimiento(maquinaria, base);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<DatosMantenimiento>({
    resolver: zodResolver(esquemaMantenimiento),
    defaultValues: {
      maquinariaId: maquinaria.id,
      fecha: hoy(),
      lecturaHorometro: resumen.actual ?? undefined,
      tipoServicio: '',
      observaciones: '',
    },
  });
  return (
    <FormularioBase
      modulo="maquinarias"
      etiquetaBoton="Guardar mantenimiento"
      cancelar={terminar}
      enviar={handleSubmit(async (datos) => {
        await registrarMantenimiento(datos);
        exito();
      })}
    >
      <div style={{ gridColumn: '1 / -1' }}>
        <IntroduccionFormulario titulo="Estado del mantenimiento">
          El avance se calcula desde la última lectura de servicio y el horómetro actual. Los
          umbrales se configuran por maquinaria en la pestaña Datos.
        </IntroduccionFormulario>
        <FichaMantenimiento resumen={resumen} />
        <IntroduccionFormulario titulo="Registrar servicio">
          La lectura se propone con el horómetro actual. Verifica el valor; guardar un servicio no
          reinicia el horómetro físico ni modifica horas trabajadas.
        </IntroduccionFormulario>
      </div>
      <Campo id="fechaServicio" etiqueta="Fecha del servicio *" error={errors.fecha}>
        <Form.Control type="date" max={hoy()} {...register('fecha')} isInvalid={!!errors.fecha} />
      </Campo>
      <Campo
        id="lecturaServicio"
        etiqueta="Horómetro del servicio (h) *"
        error={errors.lecturaHorometro}
      >
        <Form.Control
          type="number"
          min="0"
          step="0.01"
          placeholder="Ejemplo: 1250.5"
          {...register('lecturaHorometro', { valueAsNumber: true })}
          isInvalid={!!errors.lecturaHorometro}
        />
        <Form.Text>Lectura acumulada del equipo al realizar el mantenimiento.</Form.Text>
      </Campo>
      <Campo id="tipoServicio" etiqueta="Tipo de servicio *" error={errors.tipoServicio}>
        <Form.Control
          maxLength={120}
          placeholder="Ejemplo: Servicio preventivo"
          {...register('tipoServicio')}
          isInvalid={!!errors.tipoServicio}
        />
      </Campo>
      <Campo id="observacionesServicio" etiqueta="Observaciones" error={errors.observaciones}>
        <Form.Control
          as="textarea"
          rows={2}
          maxLength={500}
          placeholder="Describe brevemente el trabajo realizado"
          {...register('observaciones')}
          isInvalid={!!errors.observaciones}
        />
      </Campo>
    </FormularioBase>
  );
}

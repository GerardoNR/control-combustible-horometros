import { Alert, Form } from 'react-bootstrap';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import type { Maquinaria } from '../tipos/maquinaria';
import { esquemaConfiguracionConsumo } from '../validaciones/consumo';
import { Campo, FormularioBase } from '../../../compartido/componentes/FormularioBase';
import { useDatos } from '../../../compartido/contextos/contexto-datos';
import { puedeAdministrar } from '../../acceso/servicios/permisos';
import { IntroduccionFormulario } from './IntroduccionFormulario';
import { hoy } from '../../../compartido/utilidades/formato';

export function FormularioConsumo({
  maquinaria,
  cancelar,
  exito,
}: {
  maquinaria: Maquinaria;
  cancelar: () => void;
  exito: () => void;
}) {
  const { usuario, guardar } = useDatos();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<z.infer<typeof esquemaConfiguracionConsumo>>({
    resolver: zodResolver(esquemaConfiguracionConsumo),
    defaultValues: {
      consumoMinimoEsperado: maquinaria.consumoMinimoEsperado,
      consumoAdvertenciaMinimo: maquinaria.consumoAdvertenciaMinimo,
      horasMinimasDiarias: maquinaria.horasMinimasDiarias,
      consumoRalentiMinimo: maquinaria.consumoRalentiMinimo,
      consumoRalentiMaximo: maquinaria.consumoRalentiMaximo,
      consumoRalentiAdvertenciaMaximo: maquinaria.consumoRalentiAdvertenciaMaximo,
      consumoNormalMaximo: maquinaria.consumoNormalMaximo,
      consumoAdvertenciaMaximo: maquinaria.consumoAdvertenciaMaximo,
      referenciaConsumo: maquinaria.referenciaConsumo ?? '',
      validadoConsumoPor: maquinaria.validadoConsumoPor ?? '',
      fechaValidacionConsumo: maquinaria.fechaValidacionConsumo ?? hoy(),
    },
  });
  if (!puedeAdministrar(usuario))
    return (
      <Alert variant="info">
        Solo el administrador puede configurar límites operativos validados.
      </Alert>
    );
  return (
    <>
      <FormularioBase
        modulo="maquinarias"
        cancelar={cancelar}
        etiquetaBoton="Guardar límites de consumo"
        enviar={handleSubmit(async (datos) => {
          await guardar('maquinarias', { ...maquinaria, ...datos }, maquinaria.id);
          exito();
        })}
      >
        <div style={{ gridColumn: '1 / -1' }}>
          <IntroduccionFormulario titulo="Parámetros de consumo">
            {maquinaria.numeroEconomico} · {maquinaria.tipo} · {maquinaria.modelo}. Configura rangos
            propios del equipo. Usa información operativa aprobada; sin parámetros, el consumo queda
            sin evaluar y esta evaluación es independiente del mantenimiento y del estado operativo.
          </IntroduccionFormulario>
        </div>
        {(
          [
            { nombre: 'consumoMinimoEsperado', etiqueta: 'Mínimo esperado (L/h)' },
            { nombre: 'consumoAdvertenciaMinimo', etiqueta: 'Advertencia inferior (L/h)' },
            { nombre: 'consumoNormalMaximo', etiqueta: 'Máximo normal (L/h) *' },
            { nombre: 'consumoAdvertenciaMaximo', etiqueta: 'Máximo de advertencia (L/h) *' },
            { nombre: 'horasMinimasDiarias', etiqueta: 'Horas mínimas por día operativo' },
            { nombre: 'consumoRalentiMinimo', etiqueta: 'Mínimo en ralentí (L/h)' },
            { nombre: 'consumoRalentiMaximo', etiqueta: 'Máximo en ralentí (L/h)' },
            {
              nombre: 'consumoRalentiAdvertenciaMaximo',
              etiqueta: 'Máximo de advertencia en ralentí (L/h)',
            },
          ] as const
        ).map((campo) => (
          <Campo
            key={campo.nombre}
            id={campo.nombre}
            etiqueta={campo.etiqueta}
            error={errors[campo.nombre]}
          >
            <Form.Control
              type="number"
              min="0"
              step="0.01"
              placeholder={
                campo.nombre === 'consumoNormalMaximo' ? 'Ejemplo: 14.5 L/h' : 'Ejemplo: 17 L/h'
              }
              {...register(campo.nombre, {
                setValueAs: (valor: string) => (valor === '' ? undefined : Number(valor)),
              })}
              isInvalid={!!errors[campo.nombre]}
            />
          </Campo>
        ))}
        <p className="small text-secondary" style={{ gridColumn: '1 / -1' }}>
          El rango principal es la referencia operativa autorizada. Si configuras ralentí,
          identifica el régimen en cada lectura y suministro; los datos mixtos o sin identificar no
          se comparan. Las horas mínimas se aplican solo a fechas con operaciones, sin asumir un
          calendario de trabajo.
        </p>
        <Campo
          id="referenciaConsumo"
          etiqueta="Referencia operativa validada *"
          error={errors.referenciaConsumo}
          ancho
        >
          <Form.Control
            {...register('referenciaConsumo')}
            maxLength={120}
            placeholder="Documento, medición o criterio aprobado"
          />
        </Campo>
        <Campo id="validadoConsumoPor" etiqueta="Validado por *" error={errors.validadoConsumoPor}>
          <Form.Control
            {...register('validadoConsumoPor')}
            maxLength={120}
            placeholder="Nombre de quien valida los límites"
          />
          <Form.Text>Persona responsable de aprobar estos parámetros.</Form.Text>
        </Campo>
        <Campo
          id="fechaValidacionConsumo"
          etiqueta="Fecha de validación *"
          error={errors.fechaValidacionConsumo}
        >
          <Form.Control
            type="date"
            min="2000-01-01"
            max={hoy()}
            {...register('fechaValidacionConsumo')}
          />
          <Form.Text>Fecha en que se aprobó la referencia operativa.</Form.Text>
        </Campo>
      </FormularioBase>
    </>
  );
}

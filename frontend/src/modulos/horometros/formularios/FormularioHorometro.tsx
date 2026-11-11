import { CampoRegimenOperacion } from '../../../compartido/componentes/CampoRegimenOperacion';
import { useEffect, useState } from 'react';
import { Alert, Form } from 'react-bootstrap';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Campo, FormularioBase } from '../../../compartido/componentes/FormularioBase';
import { SelectorMaquinaria } from '../../../compartido/componentes/SelectorMaquinaria';
import { ResumenEquipoCaptura } from '../../../compartido/componentes/ResumenEquipoCaptura';
import { SelectorNombreCatalogo } from '../../../compartido/catalogos/componentes/SelectorNombreCatalogo';
import {
  normalizarNombre,
  buscarCatalogo,
} from '../../../compartido/catalogos/servicios/catalogos';
import {
  lecturaAnterior,
  asignacionParaFecha,
  referenciaAsignacion,
} from '../../../compartido/servicios/captura-diaria';
import { useDatos } from '../../../compartido/contextos/contexto-datos';
import { hoy, numero, fechaCalendario } from '../../../compartido/utilidades/formato';
import {
  analizarSecuenciaHorometro,
  horasTrabajadas,
} from '../../../compartido/utilidades/calculos';
import { esquemaHorometro } from '../validaciones/horometro';
import type { DatosHorometro, Horometro } from '../tipos/horometro';
export function FormularioHorometro({
  registro,
  cancelar,
  exito,
}: {
  registro?: Horometro;
  cancelar: () => void;
  exito: () => void;
}) {
  const { guardar, base, usuario } = useDatos();
  const [supervisada, cambiarSupervisada] = useState(false);
  const {
    register,
    handleSubmit,
    control,
    setValue,
    setError,
    formState: { errors },
  } = useForm<DatosHorometro>({
    resolver: zodResolver(esquemaHorometro),
    defaultValues: {
      ...(registro ?? {
        fecha: hoy(),
        maquinariaId: '',
        lecturaInicial: 0,
        lecturaFinal: 0,
        fechaAsignacion: '',
        operador: '',
      }),
    },
  });
  const [inicial, final, maquinariaId, fecha] = useWatch({
    control,
    name: ['lecturaInicial', 'lecturaFinal', 'maquinariaId', 'fecha'],
  });
  const previa = lecturaAnterior(base, maquinariaId, fecha, registro?.id);
  const maquinariaSeleccionada = base.maquinarias.find((equipo) => equipo.id === maquinariaId);
  const analisisLecturas = maquinariaSeleccionada
    ? analizarSecuenciaHorometro(
        maquinariaSeleccionada,
        base.horometros.filter((lectura) => lectura.id !== registro?.id),
        fecha,
      )
    : null;
  const asignacion = asignacionParaFecha(base, maquinariaId, fecha);
  useEffect(() => {
    if (registro) return;
    const anterior = lecturaAnterior(base, maquinariaId, fecha);
    setValue(
      'lecturaInicial',
      anterior?.lecturaFinal ??
        base.maquinarias.find((equipo) => equipo.id === maquinariaId)?.horometroBase ??
        0,
    );
    const asignada = asignacionParaFecha(base, maquinariaId, fecha);
    setValue('operador', asignada?.operador ?? '');
    setValue('fechaAsignacion', asignada ? fechaCalendario(new Date(asignada.inicio)) : '');
  }, [base, maquinariaId, fecha, registro, setValue]);
  const horas = horasTrabajadas({ lecturaInicial: inicial, lecturaFinal: final });
  const operadorElegido = useWatch({ control, name: 'operador' });
  const cambiaOperadorAsignado =
    !registro &&
    asignacion &&
    normalizarNombre(operadorElegido ?? '') !== normalizarNombre(asignacion.operador);
  return (
    <FormularioBase
      modulo="horometros"
      confirmacion={
        registro && operadorElegido !== registro.operador
          ? `Corregir el operador histórico de esta lectura a ${operadorElegido}. No cambiará el operador vigente ni otras lecturas.`
          : cambiaOperadorAsignado
            ? `Esta lectura usará ${operadorElegido}. La asignación vigente de ${asignacion.operador} se conservará sin cambios.`
            : undefined
      }
      cancelar={cancelar}
      enviar={handleSubmit(async (datos) => {
        if (!registro && !previa && (!supervisada || usuario.rol !== 'ADMINISTRADOR')) {
          setError('lecturaInicial', {
            message: 'Un administrador debe confirmar la lectura inicial sin historial.',
          });
          return;
        }
        await guardar(
          'horometros',
          {
            ...datos,
            operadorId:
              registro && datos.operador === registro.operador
                ? registro.operadorId
                : buscarCatalogo(base, 'operadores', datos.operador)?.id,
            asignacionId: referenciaAsignacion(base, datos, registro),
            ...(!registro && !previa
              ? { capturaInicialSupervisada: 'Confirmada por administrador' as const }
              : {}),
          },
          registro?.id,
        );
        exito();
      })}
    >
      <Campo etiqueta="Fecha *" id="fecha" error={errors.fecha}>
        <Form.Control
          type="date"
          min="2000-01-01"
          max={hoy()}
          {...register('fecha', { onChange: () => cambiarSupervisada(false) })}
          isInvalid={!!errors.fecha}
        />
      </Campo>
      <SelectorMaquinaria
        registro={register('maquinariaId', { onChange: () => cambiarSupervisada(false) })}
        error={errors.maquinariaId}
      />
      <ResumenEquipoCaptura maquinariaId={maquinariaId} mostrarResidente />
      {analisisLecturas?.motivo && (
        <Alert variant="warning" className="mb-0" style={{ gridColumn: '1/-1' }}>
          No se puede proponer una lectura continua: {analisisLecturas.motivo}
        </Alert>
      )}
      <CampoRegimenOperacion registro={register('regimenOperacion')} />
      <Campo etiqueta="Lectura inicial (h) *" id="lecturaInicial" error={errors.lecturaInicial}>
        <Form.Control
          type="number"
          min="0"
          step="0.01"
          readOnly={!registro && !!previa}
          {...register('lecturaInicial', { valueAsNumber: true })}
          isInvalid={!!errors.lecturaInicial}
        />
        <Form.Text>
          {previa
            ? 'Obtenida de la última lectura válida hasta la fecha seleccionada.'
            : 'Sin historial: confirma la lectura base con un administrador.'}
        </Form.Text>
      </Campo>
      <Campo etiqueta="Lectura final (h) *" id="lecturaFinal" error={errors.lecturaFinal}>
        <Form.Control
          type="number"
          min={inicial}
          step="0.01"
          {...register('lecturaFinal', { valueAsNumber: true })}
          isInvalid={!!errors.lecturaFinal}
        />
      </Campo>
      {!registro && !previa && maquinariaId && (
        <div style={{ gridColumn: '1/-1' }}>
          {usuario.rol === 'ADMINISTRADOR' ? (
            <Form.Check
              id="supervisionInicial"
              label="Confirmo lectura inicial supervisada"
              checked={supervisada}
              onChange={(evento) => cambiarSupervisada(evento.target.checked)}
            />
          ) : (
            <Alert variant="warning">
              Solicita al administrador la primera lectura de este equipo.
            </Alert>
          )}
        </div>
      )}
      <Campo etiqueta="Operador *" id="operador" error={errors.operador}>
        <SelectorNombreCatalogo
          tipo="operadores"
          registro={register('operador', {
            onChange: (evento: React.ChangeEvent<HTMLInputElement>) => {
              if (!registro && asignacion) {
                const coincide =
                  normalizarNombre(evento.target.value) === normalizarNombre(asignacion.operador);
                setValue(
                  'fechaAsignacion',
                  coincide ? fechaCalendario(new Date(asignacion.inicio)) : '',
                );
              }
            },
          })}
          invalido={!!errors.operador}
          valorHistorico={registro?.operador}
        />
        <Form.Text>
          {asignacion && !registro
            ? 'Propuesto desde la asignación vigente para esta fecha. Elegir otro nombre solo corrige el operador histórico de esta lectura.'
            : 'Operador histórico de esta lectura. Selecciona del catálogo si está registrado.'}
        </Form.Text>
      </Campo>
      <Campo
        etiqueta="Fecha de asignación del operador"
        id="fechaAsignacion"
        error={errors.fechaAsignacion}
      >
        <Form.Control
          type="date"
          max={fecha}
          {...register('fechaAsignacion')}
          readOnly={!registro && !!asignacion && !cambiaOperadorAsignado}
          isInvalid={!!errors.fechaAsignacion}
        />
      </Campo>
      <Alert
        variant={horas >= 0 && horas <= 24 ? 'info' : 'warning'}
        className="mb-0"
        style={{ gridColumn: '1/-1' }}
      >
        <strong>Horas trabajadas: {Number.isFinite(horas) ? numero(horas, 2) : '—'} h</strong>
        <div className="small">
          Lectura final − inicial. Cada intervalo se conserva por separado.
        </div>
      </Alert>
    </FormularioBase>
  );
}

import { FormularioResidente } from '../../maquinarias/formularios/FormularioResidente';
import { catalogosFormulario } from '../../../compartido/catalogos/servicios/catalogos-formulario';
import { CampoRegimenOperacion } from '../../../compartido/componentes/CampoRegimenOperacion';
import { residenteParaCaptura } from '../../maquinarias/servicios/responsables';
import { puedeAdministrar, puedeEscribir } from '../../acceso/servicios/permisos';
import estilos from '../../../compartido/componentes/Interfaz.module.css';
import { useEffect, useState } from 'react';
import { ResumenEquipoCaptura } from '../../../compartido/componentes/ResumenEquipoCaptura';
import { SelectorNombreCatalogo } from '../../../compartido/catalogos/componentes/SelectorNombreCatalogo';
import {
  normalizarNombre,
  buscarCatalogo,
} from '../../../compartido/catalogos/servicios/catalogos';
import {
  asignacionParaFecha,
  referenciaAsignacion,
} from '../../../compartido/servicios/captura-diaria';
import { Alert, Form } from 'react-bootstrap';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Campo, FormularioBase } from '../../../compartido/componentes/FormularioBase';
import { SelectorMaquinaria } from '../../../compartido/componentes/SelectorMaquinaria';
import { useDatos } from '../../../compartido/contextos/contexto-datos';
import { hoy, numero } from '../../../compartido/utilidades/formato';
import { esquemaSuministro } from '../validaciones/suministro';
import type { DatosSuministro, Suministro } from '../tipos/suministro';
export function FormularioSuministro({
  registro,
  cancelar,
  exito,
}: {
  registro?: Suministro;
  cancelar: () => void;
  exito: () => void;
}) {
  const { guardar, base, usuario } = useDatos();
  const [editarAsignacion, cambiarEdicionAsignacion] = useState(false);
  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<DatosSuministro>({
    resolver: zodResolver(esquemaSuministro),
    defaultValues: {
      ...(registro ?? {
        fecha: hoy(),
        maquinariaId: '',
        litrosSolicitados: 0,
        litrosCargados: 0,
        tipoCombustible: 'Diésel',
        operador: '',
        horaCarga: '07:00',
      }),
      nombreResidente: registro?.nombreResidente ?? '',
      pkResidente: registro?.pkResidente ?? '',
      numeroOrquesta: registro?.numeroOrquesta ?? '',
      nombreDespachador: registro?.nombreDespachador ?? '',
    },
  });
  const [maquinariaId, fecha, hora] = useWatch({
    control,
    name: ['maquinariaId', 'fecha', 'horaCarga'],
  });
  const asignacion = asignacionParaFecha(base, maquinariaId, fecha, hora);
  const equipo = base.maquinarias.find((actual) => actual.id === maquinariaId);
  const residenteCaptura = residenteParaCaptura(base, equipo, `${fecha}T${hora}:00`);
  const nombreAsignado = residenteCaptura?.nombre ?? '';
  const pkAsignado = residenteCaptura?.pk ?? '';
  const contextoOriginal =
    registro &&
    registro.maquinariaId === maquinariaId &&
    registro.fecha === fecha &&
    registro.horaCarga === hora;
  const nombreInicial = contextoOriginal ? (registro.nombreResidente ?? '') : nombreAsignado;
  const pkInicial = contextoOriginal ? (registro.pkResidente ?? '') : pkAsignado;
  const operadorAsignado = asignacion?.operador ?? '';
  useEffect(() => {
    if (!registro) setValue('operador', operadorAsignado);
  }, [maquinariaId, fecha, hora, operadorAsignado, registro, setValue]);
  useEffect(() => {
    setValue('nombreResidente', nombreInicial);
    setValue('pkResidente', pkInicial);
  }, [maquinariaId, nombreInicial, pkInicial, setValue]);
  const [solicitados, cargados] = useWatch({
    control,
    name: ['litrosSolicitados', 'litrosCargados'],
  });
  const responsables = useWatch({ control, name: ['operador', 'nombreResidente', 'pkResidente'] });
  const cambioResponsables =
    registro &&
    responsables.some(
      (valor, indice) =>
        (valor ?? '') !==
        (registro[(['operador', 'nombreResidente', 'pkResidente'] as const)[indice]] ?? ''),
    );
  return (
    <>
      <FormularioBase
        modulo="combustible"
        confirmacion={
          cambioResponsables
            ? `Actualizar responsables o ubicación del suministro: ${responsables.join(' · ')}. Las demás capturas y asignaciones no cambiarán.`
            : !registro &&
                asignacion &&
                normalizarNombre(responsables[0] ?? '') !== normalizarNombre(asignacion.operador)
              ? `Este suministro usará ${responsables[0]}. La asignación vigente de ${asignacion.operador} se conservará sin cambios.`
              : undefined
        }
        cancelar={cancelar}
        enviar={handleSubmit(async (datos) => {
          await guardar(
            'combustible',
            {
              ...datos,
              operadorId:
                registro && datos.operador === registro.operador
                  ? registro.operadorId
                  : buscarCatalogo(base, 'operadores', datos.operador)?.id,
              asignacionId: referenciaAsignacion(base, datos, registro),
              residenteId:
                registro && datos.nombreResidente === registro.nombreResidente
                  ? registro.residenteId
                  : buscarCatalogo(base, 'residentes', datos.nombreResidente ?? '')?.id,
              despachadorId:
                registro && datos.nombreDespachador === registro.nombreDespachador
                  ? registro.despachadorId
                  : buscarCatalogo(base, 'despachadores', datos.nombreDespachador ?? '')?.id,
              // Los campos retirados se conservan al editar registros anteriores.
              actividad: registro?.actividad,
              frenteId: registro?.frenteId,
              responsableLegado: registro?.responsableLegado,
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
            {...register('fecha')}
            isInvalid={!!errors.fecha}
          />
        </Campo>
        <SelectorMaquinaria registro={register('maquinariaId')} error={errors.maquinariaId} />
        <ResumenEquipoCaptura maquinariaId={maquinariaId} />
        <CampoRegimenOperacion registro={register('regimenOperacion')} />
        {(
          [
            { nombre: 'litrosSolicitados', etiqueta: 'Litros solicitados *' },
            { nombre: 'litrosCargados', etiqueta: 'Litros cargados *' },
          ] as const
        ).map((campo) => (
          <Campo
            key={campo.nombre}
            etiqueta={campo.etiqueta}
            id={campo.nombre}
            error={errors[campo.nombre]}
          >
            <Form.Control
              type="number"
              step="0.01"
              min="0"
              {...register(campo.nombre, { valueAsNumber: true })}
              isInvalid={!!errors[campo.nombre]}
            />
          </Campo>
        ))}
        <Campo etiqueta="Tipo de combustible *" id="tipoCombustible" error={errors.tipoCombustible}>
          <SelectorNombreCatalogo
            tipo="combustibles"
            registro={register('tipoCombustible')}
            invalido={!!errors.tipoCombustible}
            valorHistorico={registro?.tipoCombustible}
          />
        </Campo>
        <Campo etiqueta="Hora de carga *" id="horaCarga" error={errors.horaCarga}>
          <Form.Control type="time" {...register('horaCarga')} isInvalid={!!errors.horaCarga} />
        </Campo>
        <Campo id="operador" etiqueta="Operador *" error={errors.operador}>
          <SelectorNombreCatalogo
            tipo="operadores"
            registro={register('operador')}
            invalido={!!errors.operador}
            valorHistorico={registro?.operador}
          />
        </Campo>
        <Campo etiqueta="Nombre del residente" id="nombreResidente" error={errors.nombreResidente}>
          <SelectorNombreCatalogo
            tipo="residentes"
            registro={register('nombreResidente', {
              onChange: (evento: React.ChangeEvent<HTMLInputElement>) => {
                const nombre = normalizarNombre(evento.target.value);
                if (nombre === normalizarNombre(responsables[1] ?? '')) return;
                const entrada = catalogosFormulario(base).find(
                  (actual) =>
                    actual.activo &&
                    actual.tipo === 'residentes' &&
                    normalizarNombre(actual.nombre) === nombre,
                );
                setValue(
                  'pkResidente',
                  nombre === normalizarNombre(nombreAsignado) ? pkAsignado : (entrada?.pk ?? ''),
                );
              },
            })}
            valor={responsables[1] ?? ''}
            invalido={!!errors.nombreResidente}
            valorHistorico={registro?.nombreResidente}
          />
        </Campo>
        <details
          className={`${estilos.anchoCompleto} rounded border p-3`}
          open={
            !!registro ||
            !!errors.pkResidente ||
            !!errors.numeroOrquesta ||
            !!errors.nombreDespachador
          }
        >
          <summary>Datos complementarios del suministro</summary>
          <div className={`${estilos.campos} mt-3`}>
            {(
              [
                { nombre: 'pkResidente', etiqueta: 'PK donde trabaja el residente', limite: 60 },
                { nombre: 'numeroOrquesta', etiqueta: 'Número de orquesta', limite: 40 },
                { nombre: 'nombreDespachador', etiqueta: 'Nombre del despachador', limite: 120 },
              ] as const
            ).map((campo) => (
              <Campo
                key={campo.nombre}
                id={campo.nombre}
                etiqueta={campo.etiqueta}
                error={errors[campo.nombre]}
              >
                {campo.nombre === 'nombreDespachador' || campo.nombre === 'pkResidente' ? (
                  <SelectorNombreCatalogo
                    tipo={campo.nombre === 'pkResidente' ? 'ubicaciones' : 'despachadores'}
                    registro={register(campo.nombre)}
                    invalido={!!errors[campo.nombre]}
                    valor={campo.nombre === 'pkResidente' ? (responsables[2] ?? '') : undefined}
                    valorHistorico={registro?.[campo.nombre]}
                  />
                ) : (
                  <Form.Control
                    {...register(campo.nombre)}
                    maxLength={campo.limite}
                    isInvalid={!!errors[campo.nombre]}
                  />
                )}
              </Campo>
            ))}
          </div>
        </details>
        <p className="small text-secondary mb-0" style={{ gridColumn: '1 / -1' }}>
          {puedeAdministrar(usuario)
            ? 'Escribe o selecciona; las opciones nuevas se guardarán al confirmar el formulario.'
            : 'Selecciona opciones registradas. Solo el administrador puede agregar valores nuevos.'}{' '}
          El PK se completa al elegir residente. Los datos opcionales pueden quedar vacíos si
          todavía no se conocen.
        </p>
        <div style={{ gridColumn: '1 / -1' }}>
          <Alert variant="info" className="mb-0">
            <strong>
              Diferencia:{' '}
              {Number.isFinite(solicitados - cargados) ? numero(solicitados - cargados, 2) : '—'} L
            </strong>
            <div className="small">
              Solicitados − cargados. Un valor negativo indica una carga mayor a la solicitada.
            </div>
          </Alert>
        </div>
      </FormularioBase>
      {equipo && puedeEscribir(usuario, 'maquinarias') && (
        <details
          className="rounded border p-3 mt-3"
          onToggle={(evento) => cambiarEdicionAsignacion(evento.currentTarget.open)}
        >
          <summary>Cambiar asignación vigente de la maquinaria</summary>
          {editarAsignacion && (
            <FormularioResidente key={equipo.id} maquinaria={equipo} soloResidencia />
          )}
        </details>
      )}
    </>
  );
}

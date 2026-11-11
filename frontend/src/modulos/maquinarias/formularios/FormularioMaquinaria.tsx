import { IntroduccionFormulario } from './IntroduccionFormulario';
import { useState } from 'react';
import { SelectorNombreCatalogo } from '../../../compartido/catalogos/componentes/SelectorNombreCatalogo';
import { SelectorResidente } from '../../../compartido/catalogos/componentes/SelectorResidente';
import { residenteMaquinaria } from '../servicios/responsables';
import { Form } from 'react-bootstrap';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Campo, FormularioBase } from '../../../compartido/componentes/FormularioBase';
import { useDatos } from '../../../compartido/contextos/contexto-datos';
import { esquemaMaquinaria } from '../validaciones/maquinaria';
import type { DatosMaquinaria, Maquinaria } from '../tipos/maquinaria';
import { fechaCalendario, hoy } from '../../../compartido/utilidades/formato';
export function FormularioMaquinaria({
  registro,
  cancelar,
  exito,
}: {
  registro?: Maquinaria;
  cancelar: () => void;
  exito: () => void;
}) {
  const { base, guardar } = useDatos();
  const inicial = registro ? residenteMaquinaria(base, registro) : undefined;
  const [residente, cambiarResidente] = useState({
    nombre: inicial?.nombre ?? '',
    pk: inicial?.pk ?? '',
  });
  const periodoResidente = registro?.periodosResidentes?.find((periodo) => periodo.fin === null);
  const [fechaAsignacion, cambiarFechaAsignacion] = useState(
    periodoResidente ? fechaCalendario(new Date(periodoResidente.inicio)) : hoy(),
  );
  const cambioResidente =
    residente.nombre !== (inicial?.nombre ?? '') || residente.pk !== (inicial?.pk ?? '');
  const esquema = esquemaMaquinaria.superRefine((datos, contexto) => {
    if (
      base.maquinarias.some(
        (equipo) =>
          equipo.id !== registro?.id &&
          equipo.numeroEconomico.toUpperCase() === datos.numeroEconomico.toUpperCase(),
      )
    )
      contexto.addIssue({
        code: 'custom',
        path: ['numeroEconomico'],
        message: 'Este número económico ya está registrado.',
      });
  });
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<DatosMaquinaria>({
    resolver: zodResolver(esquema),
    defaultValues: registro ?? {
      numeroEconomico: '',
      placas: '',
      tipo: '',
      marca: '',
      modelo: '',
      estado: 'Operativa',
      horometroBase: 0,
    },
  });
  const campos = [
    { nombre: 'numeroEconomico', etiqueta: 'Número económico *', ejemplo: 'EXC-009' },
    { nombre: 'placas', etiqueta: 'Placas *', ejemplo: 'NL-1234-A' },
    { nombre: 'tipo', etiqueta: 'Tipo de maquinaria *', ejemplo: 'Excavadora' },
    { nombre: 'marca', etiqueta: 'Marca *', ejemplo: 'Caterpillar' },
    { nombre: 'modelo', etiqueta: 'Modelo *', ejemplo: '320 GC' },
  ] as const;
  return (
    <FormularioBase
      modulo="maquinarias"
      confirmacion={
        registro && cambioResidente
          ? `Cambiar responsable a ${residente.nombre || 'Sin asignar'} en ${residente.pk || 'Sin ubicación'}. Los periodos anteriores se conservarán.`
          : undefined
      }
      cancelar={cancelar}
      enviar={handleSubmit(async (datos) => {
        await guardar(
          'maquinarias',
          {
            ...datos,
            ...(cambioResidente
              ? {
                  motivoCambioResidente:
                    'Cambio de responsable o ubicación confirmado en formulario',
                }
              : {}),
          },
          registro?.id,
          !registro || cambioResidente
            ? { residente, fechaInicioResidente: fechaAsignacion }
            : undefined,
        );
        exito();
      })}
    >
      <div style={{ gridColumn: '1 / -1' }}>
        <IntroduccionFormulario titulo="Datos de la maquinaria">
          Ingresa la identificación, el estado y la lectura base del equipo.
        </IntroduccionFormulario>
      </div>
      {campos.map((campo) => (
        <Campo
          key={campo.nombre}
          id={campo.nombre}
          etiqueta={campo.etiqueta}
          error={errors[campo.nombre]}
        >
          {['tipo', 'marca', 'modelo'].includes(campo.nombre) ? (
            <SelectorNombreCatalogo
              tipo={
                campo.nombre === 'tipo'
                  ? 'tiposMaquinaria'
                  : campo.nombre === 'marca'
                    ? 'marcas'
                    : 'modelos'
              }
              registro={register(campo.nombre)}
              invalido={!!errors[campo.nombre]}
              valorHistorico={registro?.[campo.nombre]}
            />
          ) : (
            <Form.Control
              {...register(campo.nombre)}
              placeholder={`Ejemplo: ${campo.ejemplo}`}
              maxLength={120}
              isInvalid={!!errors[campo.nombre]}
            />
          )}
        </Campo>
      ))}
      <Campo id="estado" etiqueta="Estado *" error={errors.estado}>
        <Form.Select {...register('estado')} aria-label="Selecciona el estado de la maquinaria">
          <option value="" disabled>
            Selecciona una opción
          </option>
          <option>Operativa</option>
          <option>En mantenimiento</option>
          <option>Fuera de servicio</option>
        </Form.Select>
      </Campo>
      <Campo id="horometroBase" etiqueta="Horómetro base (h) *" error={errors.horometroBase}>
        <Form.Control
          type="number"
          step="0.01"
          min="0"
          placeholder="Ejemplo: 1250.5"
          {...register('horometroBase', { valueAsNumber: true })}
          isInvalid={!!errors.horometroBase}
        />
        <Form.Text>
          Lectura de referencia previa al primer registro. El último horómetro incluye las lecturas
          registradas.
        </Form.Text>
      </Campo>
      {!registro && (
        <>
          <div style={{ gridColumn: '1 / -1' }}>
            <p className="fw-semibold mb-2">Responsable y ubicación actual</p>
            <p className="small text-secondary mb-3">
              Asigna a la persona responsable y registra el PK correspondiente.
            </p>
          </div>
          <SelectorResidente
            nombre={residente.nombre}
            pk={residente.pk}
            cambiar={(nombre, pk) => cambiarResidente({ nombre, pk })}
          />
          <Campo id="fechaAsignacionResidente" etiqueta="Fecha de asignación *">
            <Form.Control
              type="date"
              min="2000-01-01"
              max={hoy()}
              value={fechaAsignacion}
              onChange={(evento) => cambiarFechaAsignacion(evento.target.value)}
            />
            <Form.Text>Fecha de inicio del periodo del residente y su PK.</Form.Text>
          </Campo>
        </>
      )}
      <div style={{ gridColumn: '1 / -1' }}>
        <p className="fw-semibold mb-1">Intervalos de mantenimiento</p>
        <p className="small text-secondary mb-0">
          Define las horas que activan el aviso preventivo y el límite de servicio.
        </p>
      </div>
      {(
        [
          {
            nombre: 'avisoMantenimientoHoras',
            etiqueta: 'Aviso de mantenimiento (h)',
            inicial: 200,
            ayuda: 'Muestra una alerta preventiva al acercarse al servicio.',
          },
          {
            nombre: 'limiteMantenimientoHoras',
            etiqueta: 'Límite de mantenimiento (h)',
            inicial: 250,
            ayuda: 'Marca el servicio como vencido al superar este valor.',
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
            min="1"
            step="1"
            defaultValue={registro?.[campo.nombre] ?? campo.inicial}
            {...register(campo.nombre, { valueAsNumber: true })}
            placeholder={
              campo.nombre === 'avisoMantenimientoHoras' ? 'Ejemplo: 200 h' : 'Ejemplo: 250 h'
            }
            isInvalid={!!errors[campo.nombre]}
          />
          <Form.Text>{campo.ayuda}</Form.Text>
        </Campo>
      ))}
      <p className="small text-secondary">
        Los servicios realizados se registran desde Editar, en Mantenimiento. El historial anterior
        se conserva.
      </p>
    </FormularioBase>
  );
}

import { useState } from 'react';
import { Form, Alert } from 'react-bootstrap';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useDatos } from '../../contextos/contexto-datos';
import { Campo } from '../../componentes/FormularioBase';
import { esquemaEntradaCatalogo, tiposCatalogo } from '../validaciones/catalogo';
import type { DatosEntradaCatalogo, EntradaCatalogo } from '../tipos/catalogo';
import { mensajeError } from '../../utilidades/formato';
import { Button } from 'react-bootstrap';
export function FormularioCatalogo({
  entrada,
  terminar,
}: {
  entrada?: EntradaCatalogo;
  terminar: () => void;
}) {
  const { base, guardarCatalogos } = useDatos();
  const [error, cambiarError] = useState('');
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<DatosEntradaCatalogo>({
    resolver: zodResolver(esquemaEntradaCatalogo),
    defaultValues: entrada ?? { tipo: 'operadores', codigo: '', nombre: '', pk: '', activo: true },
  });
  return (
    <Form
      noValidate
      onSubmit={handleSubmit(async (datos) => {
        cambiarError('');
        const existente = base.catalogos?.find(
          (actual) => actual.tipo === datos.tipo && actual.codigo === datos.codigo,
        );
        if (existente && existente.id !== entrada?.id) {
          cambiarError(
            'Ese identificador ya existe en este catálogo. Edita el registro existente.',
          );
          return;
        }
        try {
          await guardarCatalogos({ maquinarias: [], entradas: [datos], reemplazar: !!entrada });
          terminar();
        } catch (error) {
          cambiarError(mensajeError(error));
        }
      })}
    >
      {error && (
        <Alert variant="danger" role="alert">
          {error}
        </Alert>
      )}
      <fieldset disabled={isSubmitting}>
        <div className="row g-3">
          <div className="col-sm-6">
            <Campo id="tipoCatalogo" etiqueta="Catálogo" error={errors.tipo}>
              <Form.Select {...register('tipo')} disabled={!!entrada}>
                {tiposCatalogo.map((tipo) => (
                  <option key={tipo} value={tipo}>
                    {tipo}
                  </option>
                ))}
              </Form.Select>
            </Campo>
          </div>
          <div className="col-sm-6">
            <Campo id="codigoCatalogo" etiqueta="Identificador *" error={errors.codigo}>
              <Form.Control
                {...register('codigo')}
                readOnly={!!entrada}
                isInvalid={!!errors.codigo}
              />
            </Campo>
          </div>
          <div className="col-sm-8">
            <Campo id="nombreCatalogo" etiqueta="Nombre *" error={errors.nombre}>
              <Form.Control {...register('nombre')} isInvalid={!!errors.nombre} />
            </Campo>
          </div>
          <div className="col-sm-4">
            <Campo id="pkCatalogo" etiqueta="PK (solo residente)" error={errors.pk}>
              <Form.Control {...register('pk')} isInvalid={!!errors.pk} />
            </Campo>
          </div>
          <div className="col-12">
            <Form.Check id="activoCatalogo" label="Registro activo" {...register('activo')} />
          </div>
        </div>
        <div className="d-flex gap-2 justify-content-end mt-3">
          <Button variant="light" onClick={terminar}>
            Cancelar
          </Button>
          <Button type="submit">
            {entrada ? 'Confirmar cambios de catálogo' : 'Guardar en catálogo'}
          </Button>
        </div>
      </fieldset>
    </Form>
  );
}

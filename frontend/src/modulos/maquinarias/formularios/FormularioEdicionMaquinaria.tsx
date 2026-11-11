import estilos from './FormularioMaquinaria.module.css';
import { FormularioConsumo } from './FormularioConsumo';
import { Tab, Tabs } from 'react-bootstrap';
import type { Maquinaria } from '../tipos/maquinaria';
import { FormularioMaquinaria } from './FormularioMaquinaria';
import { FormularioMantenimiento } from './FormularioMantenimiento';
import { FormularioResidente } from './FormularioResidente';
export function FormularioEdicionMaquinaria({
  registro,
  cancelar,
  exito,
}: {
  registro?: Maquinaria;
  cancelar: () => void;
  exito: () => void;
}) {
  if (!registro)
    return (
      <div className={estilos.contenedor}>
        <FormularioMaquinaria cancelar={cancelar} exito={exito} />
      </div>
    );
  return (
    <div className={estilos.contenedor}>
      <Tabs
        id="edicion-maquinaria"
        defaultActiveKey="datos"
        transition={false}
        mountOnEnter
        unmountOnExit
        className="mb-3"
      >
        <Tab eventKey="datos" title="Datos">
          <FormularioMaquinaria registro={registro} cancelar={cancelar} exito={exito} />
        </Tab>
        <Tab eventKey="residente" title="Residente">
          <FormularioResidente maquinaria={registro} />
        </Tab>
        <Tab eventKey="consumo" title="Consumo">
          <FormularioConsumo maquinaria={registro} cancelar={cancelar} exito={exito} />
        </Tab>
        <Tab eventKey="mantenimiento" title="Mantenimiento">
          <FormularioMantenimiento maquinaria={registro} terminar={cancelar} exito={exito} />
        </Tab>
      </Tabs>
    </div>
  );
}

import { Form } from 'react-bootstrap';
import type { UseFormRegisterReturn } from 'react-hook-form';
import { Campo } from './FormularioBase';
export function CampoRegimenOperacion({ registro }: { registro: UseFormRegisterReturn }) {
  return (
    <Campo id="regimenOperacion" etiqueta="Régimen de operación">
      <Form.Select {...registro}>
        <option value="">Sin identificar</option>
        <option value="Trabajo">Trabajo</option>
        <option value="Ralentí">Ralentí</option>
        <option value="Mixto">Mixto</option>
      </Form.Select>
      <Form.Text>
        Identifica un régimen comparable en lecturas y suministros si hay rangos de ralentí.
      </Form.Text>
    </Campo>
  );
}

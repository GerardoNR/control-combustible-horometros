import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import './aplicacion/global.css';
import { ProveedorSesion } from './modulos/acceso/contextos/ProveedorSesion';
import { Aplicacion } from './aplicacion/Aplicacion';
const raiz = createRoot(document.getElementById('root')!);
function iniciar() {
  raiz.render(
  <StrictMode>
    <BrowserRouter>
      <ProveedorSesion>
        <Aplicacion />
      </ProveedorSesion>
    </BrowserRouter>
  </StrictMode>,
  );
}
iniciar();

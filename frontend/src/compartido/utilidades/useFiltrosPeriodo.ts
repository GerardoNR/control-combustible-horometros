import { useState } from 'react';
import { hoy } from './formato';
export function useFiltrosPeriodo() {
  const [busqueda, cambiarBusqueda] = useState('');
  const [equipo, cambiarEquipo] = useState('');
  const [desde, cambiarDesde] = useState(hoy);
  const [hasta, cambiarHasta] = useState(hoy);
  const invalido = !!desde && !!hasta && desde > hasta;
  const coincide = (registro: { maquinariaId: string; fecha: string }, texto: string) =>
    !invalido &&
    (!equipo || registro.maquinariaId === equipo) &&
    (!desde || registro.fecha >= desde) &&
    (!hasta || registro.fecha <= hasta) &&
    texto.toLocaleLowerCase('es').includes(busqueda.toLocaleLowerCase('es'));
  return {
    busqueda,
    cambiarBusqueda,
    equipo,
    cambiarEquipo,
    desde,
    cambiarDesde,
    hasta,
    cambiarHasta,
    invalido,
    coincide,
    limpiar: () => {
      cambiarBusqueda('');
      cambiarEquipo('');
      cambiarDesde(hoy());
      cambiarHasta(hoy());
    },
  };
}

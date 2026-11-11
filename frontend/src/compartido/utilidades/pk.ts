// La clave se usa para comparar ubicaciones. El texto capturado se guarda íntegro.
export function clavePk(valor: string) {
  const tramo = /^\s*(?:pk\s*:?\s*)?(\d+)\s*\+\s*(\d+)\s*$/i.exec(valor);
  if (!tramo) return undefined;
  return tramo
    .slice(1)
    .map((parte) => parte.replace(/^0+(?=\d)/, ''))
    .join('+');
}

export function etiquetaPk(valor: string) {
  return /^\s*pk(?:\s|:|\d)/i.test(valor) ? valor : `PK: ${valor}`;
}

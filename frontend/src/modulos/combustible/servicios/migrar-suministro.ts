export function migrarSuministroAnterior(valor: unknown): unknown {
  if (!valor || typeof valor !== 'object' || !('ingeniero' in valor)) return valor;
  const { ingeniero, ...datos } = valor;
  if (typeof ingeniero !== 'string') return datos;
  const residente = 'nombreResidente' in datos ? datos.nombreResidente : undefined;
  return {
    ...datos,
    nombreResidente:
      typeof residente === 'string' && residente.trim() ? residente : ingeniero.trim(),
    // Conserva el dato original sin sobrescribir al residente ni alterar la auditoría.
    responsableLegado: 'responsableLegado' in datos ? datos.responsableLegado : ingeniero,
  };
}

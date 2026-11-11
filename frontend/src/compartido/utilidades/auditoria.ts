export function valoresAuditables(datos: object): Record<string, string | number> {
  return Object.fromEntries(
    Object.entries(datos)
      .filter(([, valor]) => ['string', 'number', 'boolean'].includes(typeof valor))
      .map(([campo, valor]) => [campo, typeof valor === 'boolean' ? String(valor) : valor]),
  );
}

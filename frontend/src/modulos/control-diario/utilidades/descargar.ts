export function descargarArchivo(datos: Uint8Array, tipo: string, nombre: string) {
  const contenido = new Uint8Array(datos.length);
  contenido.set(datos);
  const enlace = document.createElement('a');
  const url = URL.createObjectURL(new Blob([contenido.buffer], { type: tipo }));
  try {
    enlace.href = url;
    enlace.download = nombre;
    document.body.appendChild(enlace);
    enlace.click();
  } finally {
    enlace.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

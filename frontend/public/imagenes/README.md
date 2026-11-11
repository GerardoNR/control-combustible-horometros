# Logotipo de Control de Maquinaria

- Original conservado: `logo-control.png`.
- Copia para la interfaz: `logo-control-transparente.png`, con el fondo exterior transparente y el símbolo blanco interior conservado.
- Rutas centralizadas en `src/compartido/recursos/logotipo.ts`; componente único `Logotipo.tsx` para login y sidebar, con proporción preservada mediante `object-fit: contain`.
- Si la copia no carga, se utiliza el PNG original. Ya no se usa el antiguo icono SVG de maquinaria como respaldo.

## Objetivo
- Incorporar un control visible para alternar claro/oscuro en la cabecera, respetando contraste y accesibilidad, sin romper el diseño actual.

## Implementación
- Crear `components/ModeToggle.jsx` que use `useColorMode` de Chakra (`toggleColorMode`) y muestre un `IconButton` accesible.
- Ubicar el toggle en el header de `pages/index.jsx` dentro del `HStack` superior, a la derecha del título.
- Iconos: `HiSun` para claro y `HiMoon` para oscuro con `aria-label` adecuado.
- Estilo: `variant="ghost"` con colores calculados por `useColorModeValue` para garantizar AA;
  - Borde/focus ring visibles (`outline` y `focusVisible`), tamaño `sm/md` consistente.
- Persistencia: Chakra ya guarda preferencia; no se requieren cambios extra.

## Alcance visual
- No modifica layouts; sólo añade el botón en el header.
- Verificar contraste en claro/oscuro sobre fondos actuales del header (`white`/`gray.800`).

## Verificación
- Build local y prueba manual en las 4 vistas: OData, Snowflake, Correcciones, Logs.
- Validación rápida con axe/Lighthouse para el header.

¿Apruebas que agregue el toggle conforme a este alcance mínimo?
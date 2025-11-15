## Objetivo
- Implementar modo oscuro coherente en toda la app con cumplimiento de contraste WCAG AA.
- Cubrir textos, fondos, bordes, sombras, estados (hover/focus/active), overlays, tablas, menús, drawers, tags, code blocks y gráficos.

## Principios de Contraste (WCAG)
- Texto normal ≥ 4.5:1; texto grande (≥18pt o 14pt bold) ≥ 3:1.
- Elementos interactivos (botones, enlaces, toggles): contraste de fondo/contorno y estados claramente distinguibles.
- Focus visible y accesible; no sólo color para transmitir estado.

## Tokens de Tema (Chakra)
- Añadir semantic tokens para modo claro/oscuro:
  - `colors.bg.surface`, `bg.subtle`, `bg.elevated`
  - `colors.text.primary`, `text.secondary`, `text.muted`
  - `colors.border.default`, `border.subtle`
  - `colors.accent.{blue,cyan,purple,orange,teal}` (700/500 para texto, 50/100 para fondos)
  - `shadows.elevated`, `focus.ring`
- Mapear a paletas de Chakra con variantes de alto contraste en dark (`gray.900`, `gray.800`, `gray.700`) y acentos saturados controlados.

## Implementación Técnica
- `pages/_app.js`: agregar `ColorModeScript` y `initialColorMode` `'system'` con `useSystemColorMode: true` (persistencia por usuario).
- Crear `theme` extendido con `semanticTokens` y `componentStyles` (Button, Badge, Input, Table, Drawer, Alert, Code, Tag, Tooltip).
- Introducir `useColorModeValue` para valores puntuales no cubiertos por tokens.

## Cobertura por Componentes (referencias)
- `pages/index.jsx`: Sidebar y header usan colores fijos (ej.: `bg='white'`, `gray.200`, `gray.800`). Reemplazar por tokens `bg.surface`, `border.default`, `text.primary`.
- `components/ODataModule.jsx`:
  - Fondos: `gray.50`, `white` (`ODataModule.jsx:182–183, 235–243`). Usar `bg.surface`/`bg.elevated` + `border.default`.
  - Tabla sticky header `bg='gray.50'` (`ODataModule.jsx:271–286`). Usar `bg.subtle` con alto contraste en dark.
  - Iconos y textos `gray.700/500` (`ODataModule.jsx:275–283, 291–293`). Cambiar a `text.primary`/`text.secondary`.
- `components/SnowflakeModule.jsx`:
  - Tarjetas de Stat y badges (`SnowflakeModule.jsx:426–467, 408–414`). Tokens de `bg.elevated`, `text.primary`, `accent.cyan`.
  - Tabla y scrollbars (`SnowflakeModule.jsx:472–505`). Scrollbar colores con tokens y suficiente contraste.
  - Drawer overlay (`SnowflakeModule.jsx:715–722`). Usar `bgAlpha` más oscuro con blur conservando legibilidad.
- `components/DataCorrectionModule.jsx`:
  - Code blocks `bg='gray.900'` y `color='green.200'` (`DataCorrectionModule.jsx:826–842`). Mantener alto contraste en dark/light con tokens `code.bg`, `code.fg`.
  - Alerts y badges (`DataCorrectionModule.jsx:247–279, 576–578`). Variantes accesibles en ambos modos.
  - Dialog overlay (`DataCorrectionModule.jsx:863–876`). Igualar overlay tokens.
- `components/QueryLogModule.jsx`:
  - Code blocks y badges (`QueryLogModule.jsx:447–457, 475–483`). Tokens `code.bg`, `badge.*` con contraste AA.
  - Cards `bg='white'`, borders `gray.100/200` (`QueryLogModule.jsx:398–413, 433–456`). Sustituir por tokens.

## Estados Interactivos
- Buttons: definir variantes `solid/outline/ghost` con colores oscuros y `hover/active` distintos con contraste ≥ 3:1 respecto al fondo.
- Focus ring consistente (`focus.ring`): 2px + offset, visible en ambos modos.
- Links y icon buttons: subrayado en focus o underline on hover para soporte no sólo color.

## Overlays, Drawers y Modals
- `DrawerOverlay` y `ModalOverlay`: en dark `rgba(0,0,0,0.6)`; en light `rgba(0,0,0,0.3)`. Blur ligero.
- Contenido elevado `bg.elevated` y `border.default` suave.

## Tablas, Tags y Code
- Tablas: header con `bg.subtle`, rows alternadas en dark (`bg='gray.800'` alterno) para legibilidad.
- Tags y Badges: usar esquemas `accent.*` y texto sobre fondo con contraste suficiente.
- Code blocks: tema monoespacio con fondo oscuro en ambos modos y texto claro; para light usar fondo gris medio con alto contraste.

## Gráficos e Iconos
- Iconos: tonos de `accent` con `text.primary` de respaldo; evitar grises muy bajos en dark.
- Gráficos: paleta dual con saturación moderada para dark; gridlines con `border.subtle`.

## Toggle de Modo Oscuro
- Añadir switch en Header (`pages/index.jsx` header) y en Sidebar.
- Persistencia automática con Chakra; opción de forzar modo por usuario.

## Accesibilidad y QA
- Matriz de verificación manual:
  - Texto primario/secondary/muted sobre `bg.surface/elevated/subtle` en ambos modos.
  - Estados hover/active/focus de Buttons/Links/IconButtons.
  - Tabla (header, celdas, hover), Alerts, Badges, Tags.
  - Overlays/Drawers/Modals y Code blocks.
- Comprobación de ratios con herramienta (p. ej. axe + Lighthouse) en vistas principales.

## Fases de Implementación
1. Tema y tokens: crear `semanticTokens`, `ColorModeScript`, `initialColorMode` y `componentStyles` globales.
2. Sustitución de colores fijos por tokens en `pages/index.jsx` y todos los `components/*` (referencias citadas).
3. Estados y overlays: focus ring, hover/active, overlays consistentes.
4. QA de contraste + ajustes finos; adopción `useColorModeValue` donde haga falta.

## Entregables
- Tema extendido con tokens y estilos por componente.
- Toggle de modo oscuro en Header.
- Informe de contraste WCAG AA con capturas y ratios por secciones.

¿Confirmas esta implementación de modo oscuro para comenzar por la Fase 1 (tema y tokens) y seguir con la sustitución en componentes? 
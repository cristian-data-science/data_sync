## Objetivo
- Unificar el frontend (React+Vite) y backend (Express) en un solo proyecto Next.js.
- Mantener endpoints y lógica (OData y Snowflake) con cambios mínimos.
- Desplegar en Vercel con un solo `npm run` (`next dev/build/start`).

## Arquitectura Destino
- **UI**: Next.js Pages Router para migración rápida desde Vite.
- **Providers**: `pages/_app.js` con `ChakraProvider` y `QueryClientProvider` (equivalente a `frontend/src/main.jsx` líneas 33–53).
- **Rutas API**: `pages/api/...` replicando:
  - `/api/odata/search` y `/api/odata/update` (de `backend/src/index.js` líneas 17–51, y `services/odataService.js`).
  - `/api/snowflake/*` (de `backend/src/routes/snowflakeRoutes.js` líneas 17–268).
- **Servicios**: mover `backend/src/services/*.js` y `backend/src/constants/*.js` a `lib/` y reutilizar tal cual.

## Migración Frontend (mínimos cambios)
- Crear `pages/index.jsx` y portar `frontend/src/App.jsx` manteniendo la UI y lógica de selección de módulos.
- Mover `frontend/src/components/*` a `components/*` sin modificar la lógica.
- Reemplazar `import.meta.env.VITE_API_BASE_URL` por base relativa `/api`:
  - Ejemplos: `ODataModule.jsx` (30–35), `SnowflakeModule.jsx` (46–51), `DataCorrectionModule.jsx` (44–49), `QueryLogModule.jsx` (29–34) → `axios.create({ baseURL: '/api' })`.
- Eliminar `index.html` y `main.jsx` (Vite) y crear `_app.js` con los providers.

## Migración Backend a API Routes
- Crear archivos en `pages/api/` que envuelvan la lógica existente:
  - `pages/api/odata/search.js` → usa `getToken`, `searchByFilter` de `lib/odataService`.
  - `pages/api/odata/update.js` → usa `patchRecord` de `lib/odataService`.
  - `pages/api/snowflake/test.js`, `comparacion-canal.js`, `mismatch-pedidos.js`, `mismatch-analysis/[salesId].js`, `correcciones/[salesId].js`, `query-logs/index.js`, `query-logs/[logId]/rollback.js`, `query-custom.js` → reutilizan `lib/snowflakeService` y `lib/queryLogService`.
- Sustituir `express` por handlers de Next (`req`, `res`), manteniendo nombres y respuestas JSON.
- Omitir `express-rate-limit` inicialmente para simplicidad; si es necesario, añadir rate limit ligero posteriormente.

## Variables de Entorno
- Backend: mantener nombres actuales (`CLIENT_ID`, `CLIENT_SECRET`, `TOKEN_URL`, `SCOPE_URL`, `BASE_URL`, `ENTITY_NAME`, `FILTER_FIELD`, `DATAAREAID`, `SNOWFLAKE_*`, `LOG_EXECUTOR`).
- Frontend: eliminar `VITE_API_BASE_URL`; las llamadas van a `/api`.
- En Vercel, crear las mismas variables en el panel del proyecto (Producción, Preview, Development).

## Scripts y Configuración
- `package.json` en raíz: reemplazar por scripts Next: `dev`, `build`, `start`.
- Eliminar `frontend` y `backend` `package.json` independientes; consolidar dependencias (React, Chakra, tanstack-query, axios, snowflake-sdk, dotenv, etc.).
- Sin `vercel.json` necesario; Vercel detecta Next automáticamente.

## Despliegue en Vercel
- Subir el repo (GitHub/GitLab/Bitbucket) y crear proyecto en Vercel apuntando a la raíz.
- Configurar variables de entorno en Vercel.
- Build automático (`next build`) y deploy.

## Validación
- Local: `npm run dev` y probar UI y endpoints:
  - `/api/odata/search` y `/api/odata/update` con casos reales.
  - Endpoints Snowflake principales.
- En Vercel: probar rutas API y flujos UI; revisar tiempos y errores.

## Cambios Mínimos y Alcance
- Reutilizar servicios de backend sin reescritura.
- Actualizar solo inicialización de axios (base `/api`).
- Mantener estructura de respuestas y parámetros para no tocar componentes.

## Riesgos y Mitigaciones
- **snowflake-sdk en serverless**: si hubiese incompatibilidades, migrar a `snowflake-sdk` HTTP (misma API) o usar Funciones con `Node.js` runtime (no Edge).
- **Tiempo de ejecución**: dividir consultas largas en endpoints paginados si Vercel impone límites.

¿Confirmas que implementemos esta migración con este alcance y estructura?
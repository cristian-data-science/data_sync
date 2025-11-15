## Objetivo
- Crear una app web en React, estética y simple, para monitorear y corregir datos de `PdSalesVSCostProcesseds` filtrando por `SalesId/SALESID`, reemplazando el notebook.

## Arquitectura
- **Frontend**: React + Vite, UI con Chakra UI, React Query para datos.
- **Backend**: Node.js + Express como proxy seguro (OAuth2 client_credentials, OData a D365 FO).
- **Seguridad**: Secretos sólo en backend; frontend consume endpoints del backend.

## Backend (Express)
1. **Token**: Servicio interno con caché (1h), usando `.env`: `CLIENT_ID`, `CLIENT_SECRET`, `TOKEN_URL`, `SCOPE_URL`.
2. **Búsqueda**: `GET /api/odata/search?salesId=` monta `BASE_URL/data/ENTITY_NAME?$filter=FILTER_FIELD eq 'valor'` con escape `'`→`''`.
3. **Actualización**: `PATCH /api/odata/update` con `salesId`, `changes` y opcional `DATAAREAID`; aplica `If-Match: *`.
4. **Headers**: `Accept: application/json`, `Prefer: odata.maxpagesize=5000`.
5. **Errores**: Devolver `status`, `content-type`, y extracto `text` cuando no sea JSON.

## Frontend (React)
1. **Layout**: Encabezado, buscador de `SalesId`, tabla de resultados, drawer/modal de edición.
2. **Datos**: React Query para `GET /api/odata/search`; axios para `PATCH`.
3. **UX**: Skeleton/Spinners, toasts de éxito/error, validación mínima.
4. **Estilo**: Tema claro con Chakra, cards y tabla responsiva.

## Variables de Entorno
- **Backend .env**: `CLIENT_ID`, `CLIENT_SECRET`, `TOKEN_URL`, `SCOPE_URL`, `BASE_URL`, `ENTITY_NAME=PdSalesVSCostProcesseds`, `FILTER_FIELD=SalesId/SALESID`, `DATAAREAID` (opcional).
- **Frontend .env.local**: `VITE_API_BASE_URL`.

## Pasos de Implementación
1. Inicializar backend (Express), endpoints `search` y `update` con token cache.
2. Inicializar frontend (Vite + React), instalar Chakra UI y React Query.
3. Implementar UI (buscador, tabla, edición), conectar a backend.
4. Manejar estados de carga y errores; toasts y validaciones.
5. Probar con `PAT-001260898` y otros IDs; verificar `GET`/`PATCH` contra D365.

## Validación
- Comprobar respuesta `value` y que `PATCH` refleja cambios (200/204) y maneja 412 (ETag) si aplica.

## Entregables
- `backend/` con Express y `.env.example`.
- `frontend/` con React + Chakra y `.env.local.example`.
- Scripts para desarrollo y ejecución.

## Mejoras Futuras
- Filtros múltiples, exportación CSV, bitácora de correcciones/auditoría.
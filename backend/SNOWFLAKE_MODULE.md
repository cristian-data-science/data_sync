# Módulo Snowflake - Comparación de Ventas y Costos

## 📋 Descripción

Este módulo permite ejecutar queries en Snowflake para comparar datos entre:
- **BASE**: `ERP_ACCOUNTING_TRANSACTION` (Ledger 400000)
- **VISTA**: `VW_VENTA_COSTO_LINEAS_TEST` (Ledger 400000)

## 🔧 Configuración

### 1. Variables de Entorno

Edita el archivo `.env` en la raíz del proyecto y agrega:

```env
# Snowflake Configuration
SNOWFLAKE_ACCOUNT=tu-cuenta.snowflakecomputing.com
SNOWFLAKE_USERNAME=tu-usuario
SNOWFLAKE_PASSWORD=tu-password
SNOWFLAKE_WAREHOUSE=tu-warehouse
SNOWFLAKE_DATABASE=PATAGONIA
SNOWFLAKE_SCHEMA=CORE_TEST
SNOWFLAKE_ROLE=tu-role
```

### 2. Instalación

Las dependencias ya están instaladas si ejecutaste:
```bash
npm install
```

## 🚀 Endpoints Disponibles

### 1. Test de Conexión
```http
GET /api/snowflake/test
```
Verifica que la conexión a Snowflake funcione correctamente.

**Respuesta:**
```json
{
  "success": true,
  "message": "Conexión exitosa a Snowflake",
  "data": {
    "VERSION": "8.x.x",
    "DB": "PATAGONIA"
  }
}
```

### 2. Comparación por Canal
```http
GET /api/snowflake/comparacion-canal
```
Ejecuta la comparación de totales por canal entre BASE y VISTA.

**Respuesta:**
```json
{
  "success": true,
  "count": 5,
  "data": [
    {
      "CANAL": "CORPORATIVO",
      "BASE_TOTAL": 1234567.89,
      "VIEW_TOTAL": 1234567.89,
      "DIFF_BASE_VIEW": 0.00,
      "PCT_BASE_VIEW": 0.0000
    }
  ],
  "query": "COMPARACION_POR_CANAL",
  "timestamp": "2025-11-13T20:30:00.000Z"
}
```

### 3. Pedidos con Diferencias (Mismatch)
```http
GET /api/snowflake/mismatch-pedidos
```
Retorna los pedidos que tienen diferencias entre BASE y VISTA.

**Respuesta:**
```json
{
  "success": true,
  "count": 10,
  "data": [
    {
      "CANAL": "CORPORATIVO",
      "SALESID": "PAT-001260898",
      "INVOICEID": "FV-001",
      "BASE_AMT": 1000.00,
      "VIEW_AMT": 999.95,
      "DIFF_AMT": 0.05,
      "MATCH_STATUS": "AMOUNT_MISMATCH"
    }
  ],
  "query": "MISMATCH_PEDIDOS",
  "timestamp": "2025-11-13T20:30:00.000Z"
}
```

### 4. Query Personalizada
```http
POST /api/snowflake/query-custom
Content-Type: application/json

{
  "query": "SELECT * FROM PATAGONIA.CORE_TEST.ERP_ACCOUNTING_TRANSACTION LIMIT 10"
}
```

## 📁 Estructura de Archivos

```
backend/src/
├── queries/
│   └── snowflake-queries.js    # Queries SQL de Snowflake
├── services/
│   └── snowflakeService.js     # Servicio de conexión a Snowflake
└── routes/
    └── snowflakeRoutes.js      # Endpoints API de Snowflake
```

## 📝 Queries Disponibles

### Query 1: Comparación por Canal
- **Archivo**: `src/queries/snowflake-queries.js`
- **Constante**: `QUERY_COMPARACION_POR_CANAL`
- **Descripción**: Compara totales por canal (BASE vs VISTA)
- **Rango de fechas**: 2020-01-01 hasta ayer (dinámico)

### Query 2: Mismatch de Pedidos
- **Archivo**: `src/queries/snowflake-queries.js`
- **Constante**: `QUERY_MISMATCH_PEDIDOS`
- **Descripción**: Identifica pedidos con diferencias
- **Tolerancia**: 0.005 (configurable en la query)
- **Estados posibles**:
  - `ONLY_IN_BASE`: Solo existe en BASE
  - `ONLY_IN_VIEW`: Solo existe en VISTA
  - `AMOUNT_MISMATCH`: Montos difieren
  - `MATCH_OK`: Coincide (filtrado)

## 🔐 Seguridad

- Las credenciales de Snowflake nunca se exponen al frontend
- Todas las queries se ejecutan en el backend
- Rate limiting aplicado (60 requests por minuto)

## 🧪 Prueba Rápida

```bash
# 1. Asegúrate de tener las credenciales en .env
# 2. Inicia el servidor
npm run dev

# 3. Prueba la conexión
curl http://localhost:3001/api/snowflake/test

# 4. Ejecuta la comparación por canal
curl http://localhost:3001/api/snowflake/comparacion-canal

# 5. Busca pedidos con diferencias
curl http://localhost:3001/api/snowflake/mismatch-pedidos
```

## ⚠️ Notas Importantes

1. Las queries pueden tardar varios segundos dependiendo del volumen de datos
2. El rango de fechas en `QUERY_COMPARACION_POR_CANAL` es dinámico (hasta ayer)
3. El rango de fechas en `QUERY_MISMATCH_PEDIDOS` está hardcodeado (2020-01-01 a 2025-10-09)
4. Para modificar las queries, edita `src/queries/snowflake-queries.js`

## 🔄 Próximos Pasos

- [ ] Agregar UI en el frontend para el módulo Snowflake
- [ ] Permitir configurar rango de fechas desde el frontend
- [ ] Agregar caché de resultados
- [ ] Exportar resultados a CSV/Excel

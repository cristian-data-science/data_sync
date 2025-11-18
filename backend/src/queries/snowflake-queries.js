import { PROCESSED_SALESLINE_TABLE } from '../constants/tables.js';

const DEFAULT_DATE_FROM = '2020-01-01';
const VIEW_LINE_TABLE = 'PATAGONIA.CORE_TEST.VW_VENTA_COSTO_LINEAS_TEST';

const getYesterdayISO = () => {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return date.toISOString().slice(0, 10);
};

/**
 * Snowflake Queries - Comparación de ventas y costos
 * Autor: Sistema de Monitoreo D365
 * Descripción: Queries para comparar BASE (ERP_ACCOUNTING_TRANSACTION) vs VISTA (VW_VENTA_COSTO_LINEAS_TEST)
 */

/**
 * Query 1: Comparación POR CANAL (solo LEDGER 400000)
 * Compara totales por canal entre BASE y VISTA
 */
export function buildComparacionPorCanalQuery({ fromDate, toDate } = {}) {
  const dateFrom = fromDate || DEFAULT_DATE_FROM;
  const dateTo = toDate || getYesterdayISO();

  return `
/* ============================================================
   Comparación POR CANAL (solo LEDGER 400000) — BASE vs VISTA
   Fuentes:
     1) BASE: ERP_ACCOUNTING_TRANSACTION (400000)  -> BASE_TOTAL (signo invertido)
     2) VISTA: VW_VENTA_COSTO_LINEAS_TEST (400000) -> VIEW_TOTAL
   Fechas controladas en UN SOLO LUGAR (JSON abajo)
   Rango dinámico: 2020-01-01 a (CURRENT_DATE() - 1)
   ============================================================ */

WITH
WINDOW_RAW AS (
  SELECT OBJECT_CONSTRUCT(
           'from', '${dateFrom}',
           'to',   '${dateTo}'
         ) AS W
),
WINDOW AS (
  SELECT
    TO_DATE(W:"from"::string) AS D_FROM,
    TO_DATE(W:"to"::string)   AS D_TO
  FROM WINDOW_RAW
),

/* ====== BASE 400000 (rango de fechas) ====== */
BASE_400000_F AS (
  SELECT
    COALESCE(TRIM(UPPER(b.GAPCANALDIMENSION)), '__NULL__')   AS CANAL_NORM,
    CAST(b.ACCOUNTINGCURRENCYAMOUNT AS NUMBER(38,6))         AS AMT,
    CAST(b.ACCOUNTINGDATE AS DATE)                           AS ACCOUNTINGDATE
  FROM PATAGONIA.CORE_TEST.ERP_ACCOUNTING_TRANSACTION b
  WHERE TO_NUMBER(REGEXP_REPLACE(b.LEDGERACCOUNT::STRING, '[^0-9]', '')) = 400000
    AND b.ACCOUNTINGDATE BETWEEN (SELECT D_FROM FROM WINDOW) AND (SELECT D_TO FROM WINDOW)
    /* ⛔ Excluir SALESID vacío o en blanco */
    AND NULLIF(TRIM(COALESCE(b.SALESID::STRING, '')), '') IS NOT NULL
),

/* ====== VISTA (filtrada a 400000, mismo rango) ====== */
VIEW_400000_F AS (
  SELECT
    COALESCE(TRIM(UPPER(v.GAPCANALDIMENSION)), '__NULL__')    AS CANAL_NORM,
    CAST(v.ACCOUNTINGCURRENCYAMOUNT AS NUMBER(38,6))          AS AMT,
    CAST(v.ACCOUNTINGDATE AS DATE)                            AS ACCOUNTINGDATE
  FROM PATAGONIA.CORE_TEST.VW_VENTA_COSTO_LINEAS_TEST v
  WHERE v.LEDGERACCOUNT = 400000
    AND v.ACCOUNTINGDATE BETWEEN (SELECT D_FROM FROM WINDOW) AND (SELECT D_TO FROM WINDOW)
    /* ⛔ Excluir SALESID vacío o en blanco */
    AND NULLIF(TRIM(COALESCE(v.SALESID::STRING, '')), '') IS NOT NULL
),

/* ====== Agregaciones por CANAL ====== */
/* BASE_TOTAL con signo invertido */
BASE_AGG AS (
  SELECT CANAL_NORM, (SUM(AMT) * (-1))::NUMBER(38,6) AS BASE_TOTAL
  FROM BASE_400000_F
  GROUP BY CANAL_NORM
),
VIEW_AGG AS (
  SELECT CANAL_NORM, SUM(AMT)::NUMBER(38,6) AS VIEW_TOTAL
  FROM VIEW_400000_F
  GROUP BY CANAL_NORM
)

/* ====== Comparativo final por canal (BASE vs VISTA) ====== */
SELECT
  COALESCE(b.CANAL_NORM, v.CANAL_NORM)                                                            AS CANAL,
  b.BASE_TOTAL,
  v.VIEW_TOTAL,
  (COALESCE(b.BASE_TOTAL, 0::NUMBER(38,6)) - COALESCE(v.VIEW_TOTAL, 0::NUMBER(38,6)))::NUMBER(38,6) AS DIFF_BASE_VIEW,
  CASE
    WHEN COALESCE(b.BASE_TOTAL, 0::NUMBER(38,6)) = 0::NUMBER(38,6) THEN NULL
    ELSE ((COALESCE(b.BASE_TOTAL, 0::NUMBER(38,6)) - COALESCE(v.VIEW_TOTAL, 0::NUMBER(38,6)))
           / NULLIF(b.BASE_TOTAL, 0::NUMBER(38,6)))
  END AS PCT_BASE_VIEW
FROM BASE_AGG b
FULL OUTER JOIN VIEW_AGG v
  ON COALESCE(b.CANAL_NORM, '__NULL__') = COALESCE(v.CANAL_NORM, '__NULL__')
ORDER BY CANAL;
`;
}

/**
 * Query 2: MISMATCH SUMMARY — Pedidos con diferencias
 * Identifica pedidos específicos con diferencias entre BASE y VISTA
 */
export function buildMismatchPedidosQuery({ fromDate, toDate, tolerance } = {}) {
  const dateFrom = fromDate || DEFAULT_DATE_FROM;
  const dateTo = toDate || getYesterdayISO();
  const tol = typeof tolerance === 'number' ? tolerance : 0.005;

  return `
/* ============================================================
   MISMATCH SUMMARY — BASE (400000, signo invertido) vs VISTA (400000)
   Claves: CANAL, SALESID, INVOICEID
   Fechas / Tolerancia en UN SOLO LUGAR
   ============================================================ */
WITH
-- Cambia el rango y tolerancia solo aquí:
WINDOW_RAW AS (
  SELECT OBJECT_CONSTRUCT(
           'from', '${dateFrom}',
           'to',   '${dateTo}',
           'tol',  ${tol}
         ) AS W
),
WINDOW AS (
  SELECT
    TO_DATE(W:"from"::string)      AS D_FROM,
    TO_DATE(W:"to"::string)        AS D_TO,
    (W:"tol"::number(10,6))        AS TOL
  FROM WINDOW_RAW
),

/* ====== BASE 400000 (rango) ====== */
BASE_RAW AS (
  SELECT
    COALESCE(TRIM(UPPER(b.GAPCANALDIMENSION)), '__NULL__')               AS CANAL_NORM,
    COALESCE(TRIM(UPPER(b.SALESID)), '__NULL__')                         AS SALESID_NORM,
    COALESCE(TRIM(UPPER(b.INVOICEID)), '__NULL__')                       AS INVOICEID_NORM,
    CAST(b.ACCOUNTINGCURRENCYAMOUNT AS NUMBER(38,6))                     AS AMT
  FROM PATAGONIA.CORE_TEST.ERP_ACCOUNTING_TRANSACTION b
  WHERE TO_NUMBER(REGEXP_REPLACE(b.LEDGERACCOUNT::STRING, '[^0-9]', '')) = 400000
    AND b.ACCOUNTINGDATE BETWEEN (SELECT D_FROM FROM WINDOW) AND (SELECT D_TO FROM WINDOW)
),
BASE_GRP AS (
  /* Signo invertido para alinear con la VISTA/LÍNEAS */
  SELECT CANAL_NORM, SALESID_NORM, INVOICEID_NORM,
         (SUM(AMT) * (-1))::NUMBER(38,6) AS BASE_AMT
  FROM BASE_RAW
  GROUP BY 1,2,3
),

/* ====== VISTA 400000 (mismo rango) ====== */
VIEW_RAW AS (
  SELECT
    COALESCE(TRIM(UPPER(v.GAPCANALDIMENSION)), '__NULL__')               AS CANAL_NORM,
    COALESCE(TRIM(UPPER(v.SALESID)), '__NULL__')                         AS SALESID_NORM,
    COALESCE(TRIM(UPPER(v.INVOICEID)), '__NULL__')                       AS INVOICEID_NORM,
    CAST(v.ACCOUNTINGCURRENCYAMOUNT AS NUMBER(38,6))                     AS AMT
  FROM PATAGONIA.CORE_TEST.VW_VENTA_COSTO_LINEAS_TEST v
  WHERE v.LEDGERACCOUNT = 400000
    AND v.ACCOUNTINGDATE BETWEEN (SELECT D_FROM FROM WINDOW) AND (SELECT D_TO FROM WINDOW)
),
VIEW_GRP AS (
  SELECT CANAL_NORM, SALESID_NORM, INVOICEID_NORM,
         SUM(AMT)::NUMBER(38,6) AS VIEW_AMT
  FROM VIEW_RAW
  GROUP BY 1,2,3
),

/* ====== Emparejar y detectar diferencias ====== */
PAIR AS (
  SELECT
    COALESCE(b.CANAL_NORM, v.CANAL_NORM)           AS CANAL_NORM,
    COALESCE(b.SALESID_NORM, v.SALESID_NORM)       AS SALESID_NORM,
    COALESCE(b.INVOICEID_NORM, v.INVOICEID_NORM)   AS INVOICEID_NORM,
    b.BASE_AMT, v.VIEW_AMT,
    (COALESCE(b.BASE_AMT, 0) - COALESCE(v.VIEW_AMT, 0))::NUMBER(38,6) AS DIFF_AMT
  FROM BASE_GRP b
  FULL OUTER JOIN VIEW_GRP v
    ON  COALESCE(b.CANAL_NORM,'__NULL__')    = COALESCE(v.CANAL_NORM,'__NULL__')
    AND COALESCE(b.SALESID_NORM,'__NULL__')  = COALESCE(v.SALESID_NORM,'__NULL__')
    AND COALESCE(b.INVOICEID_NORM,'__NULL__')= COALESCE(v.INVOICEID_NORM,'__NULL__')
),
MISMATCH AS (
  SELECT
    p.*,
    CASE
      WHEN p.VIEW_AMT IS NULL AND p.BASE_AMT IS NOT NULL THEN 'ONLY_IN_BASE'
      WHEN p.BASE_AMT IS NULL AND p.VIEW_AMT IS NOT NULL THEN 'ONLY_IN_VIEW'
      WHEN ABS(p.DIFF_AMT) > (SELECT TOL FROM WINDOW)      THEN 'AMOUNT_MISMATCH'
      ELSE 'MATCH_OK'
    END AS MATCH_STATUS
  FROM PAIR p
)
SELECT
  CANAL_NORM    AS CANAL,
  SALESID_NORM  AS SALESID,
  INVOICEID_NORM AS INVOICEID,
  BASE_AMT,
  VIEW_AMT,
  DIFF_AMT,
  MATCH_STATUS
FROM MISMATCH
WHERE MATCH_STATUS <> 'MATCH_OK' and SALESID <> ''
ORDER BY CANAL, SALESID, INVOICEID;
`;
}

export const QUERY_DETALLE_LINEAS_POR_SALESID = `
/* ============================================================
   DETALLE POR LÍNEA — ERP_PROCESSED_SALESLINE para un SalesId específico
   ============================================================ */
SELECT *
FROM ${PROCESSED_SALESLINE_TABLE}
WHERE TRIM(UPPER(SALESID)) = TRIM(UPPER(?))
ORDER BY LINECREATIONSEQUENCENUMBER;
`;

const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;

const parseIsoDate = (value) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return isoDateRegex.test(trimmed) ? trimmed : null;
};

const pickSingleValue = (value) => {
  if (Array.isArray(value)) {
    const nonEmpty = value.find((item) => typeof item === 'string' && item.trim().length > 0);
    return nonEmpty ? nonEmpty.trim() : '';
  }
  if (value === null || value === undefined) return '';
  return String(value).trim();
};

const splitCsvValues = (value) => {
  const raw = Array.isArray(value) ? value : [value];
  return raw
    .filter((entry) => entry !== undefined && entry !== null)
    .flatMap((entry) =>
      String(entry)
        .split(',')
        .map((token) => token.trim())
    )
    .filter((token) => token.length > 0);
};

const DEFAULT_VISTA_COLUMNS = [
  'ACCOUNTINGDATE',
  'SALESID',
  'INVOICEID',
  'GAPCANALDIMENSION',
  'SOURCE_FLAG',
  'ACCOUNTINGCURRENCYAMOUNT',
  'LEDGERACCOUNT',
];

const DEFAULT_PROCESSED_COLUMNS = [
  'SALESID',
  'INVOICEID',
  'ITEMID',
  'LINENUM',
  'LINEAMOUNT',
  'QTY',
  'INVOICEDATE',
  'SNOWFLAKE_CREATED_AT',
  'SNOWFLAKE_UPDATED_AT',
  'LINECREATIONSEQUENCENUMBER',
  'MARKETTYPE',
  'DATA_SOURCE',
];

const LINE_SOURCE_CONFIG = {
  vista: {
    key: 'vista',
    table: VIEW_LINE_TABLE,
    label: 'VW_VENTA_COSTO_LINEAS_TEST',
    orderBy: 'ACCOUNTINGDATE DESC, SALESID',
    dateFilter: {
      fromParam: 'accountingDateFrom',
      toParam: 'accountingDateTo',
      expression: 'CAST(ACCOUNTINGDATE AS DATE)',
    },
    filters: [
      { param: 'salesId', column: 'SALESID', type: 'text', match: 'contains', upper: true },
      { param: 'invoiceId', column: 'INVOICEID', type: 'text', match: 'contains', upper: true },
      { param: 'canal', column: 'GAPCANALDIMENSION', type: 'list', upper: true },
      { param: 'sourceFlag', column: 'SOURCE_FLAG', type: 'list', upper: true },
    ],
    defaultColumns: DEFAULT_VISTA_COLUMNS,
    maxRows: 10000,
    maxDateSpanDays: null,
  },
  procesada: {
    key: 'procesada',
    table: PROCESSED_SALESLINE_TABLE,
    label: 'ERP_PROCESSED_SALESLINE',
    orderBy: 'COALESCE(TRY_TO_DATE(INVOICEDATE), CAST(SNOWFLAKE_CREATED_AT AS DATE)) DESC, SALESID',
    dateFilter: {
      fromParam: 'invoiceDateFrom',
      toParam: 'invoiceDateTo',
      expression: 'TRY_TO_DATE(INVOICEDATE)',
    },
    filters: [
      { param: 'salesId', column: 'SALESID', type: 'text', match: 'contains', upper: true },
      { param: 'invoiceId', column: 'INVOICEID', type: 'text', match: 'contains', upper: true },
    ],
    defaultColumns: DEFAULT_PROCESSED_COLUMNS,
    maxRows: 15000,
    maxDateSpanDays: null,
  },
};

export function buildLineDownloadQuery({ source = 'vista', limit, filters = {}, includeAllColumns = false } = {}) {
  const normalizedSource = typeof source === 'string' ? source.toLowerCase() : 'vista';
  const config = LINE_SOURCE_CONFIG[normalizedSource] || LINE_SOURCE_CONFIG.vista;

  const whereClauses = [];
  const binds = [];
  const appliedFilters = {};

  if (config.dateFilter) {
    const fromValue = parseIsoDate(pickSingleValue(filters[config.dateFilter.fromParam]));
    const toValue = parseIsoDate(pickSingleValue(filters[config.dateFilter.toParam]));
    if (fromValue && toValue && fromValue > toValue) {
      throw new Error('El rango de fechas es inválido (desde debe ser anterior o igual a hasta)');
    }
    if (fromValue && toValue && config.maxDateSpanDays) {
      const spanMs = new Date(`${toValue}T00:00:00Z`).getTime() - new Date(`${fromValue}T00:00:00Z`).getTime();
      const spanDays = spanMs / (1000 * 60 * 60 * 24);
      if (spanDays > config.maxDateSpanDays) {
        throw new Error(
          `El rango máximo permitido para ${config.label} es de ${config.maxDateSpanDays} días. Reduce el periodo o usa filtros adicionales.`
        );
      }
    }
    if (fromValue) {
      whereClauses.push(`${config.dateFilter.expression} >= TO_DATE(?)`);
      binds.push(fromValue);
      appliedFilters[config.dateFilter.fromParam] = fromValue;
    }
    if (toValue) {
      whereClauses.push(`${config.dateFilter.expression} <= TO_DATE(?)`);
      binds.push(toValue);
      appliedFilters[config.dateFilter.toParam] = toValue;
    }
  }

  config.filters.forEach((filterDef) => {
    const raw = filters[filterDef.param];
    if (filterDef.type === 'text') {
      const value = pickSingleValue(raw);
      if (!value) return;
      const prepared = filterDef.upper ? value.toUpperCase() : value;
      const columnExpr = filterDef.upper ? `UPPER(${filterDef.column})` : filterDef.column;
      const matchOperator = filterDef.match === 'contains' ? 'LIKE' : '=';
      whereClauses.push(`${columnExpr} ${matchOperator} ?`);
      binds.push(filterDef.match === 'contains' ? `%${prepared}%` : prepared);
      appliedFilters[filterDef.param] = value;
    } else if (filterDef.type === 'list') {
      const values = splitCsvValues(raw).map((token) => (filterDef.upper ? token.toUpperCase() : token));
      if (!values.length) return;
      const columnExpr = filterDef.upper ? `UPPER(${filterDef.column})` : filterDef.column;
      const placeholders = values.map(() => '?').join(', ');
      whereClauses.push(`${columnExpr} IN (${placeholders})`);
      binds.push(...values);
      appliedFilters[filterDef.param] = values;
    }
  });

  const numericLimit = Number.parseInt(pickSingleValue(limit ?? filters.limit ?? ''), 10);
  const finalLimit = Number.isFinite(numericLimit) && numericLimit > 0 ? numericLimit : null;
  const enforcedLimit = config.maxRows && finalLimit && finalLimit > config.maxRows ? config.maxRows : finalLimit;
  if (finalLimit && config.maxRows && finalLimit > config.maxRows) {
    throw new Error(`El límite máximo permitido para ${config.label} es ${config.maxRows} filas.`);
  }

  const selectColumns = includeAllColumns || !config.defaultColumns?.length
    ? '*'
    : config.defaultColumns.join(', ');

  const sqlParts = [`SELECT ${selectColumns}`, `FROM ${config.table}`];
  if (whereClauses.length) {
    sqlParts.push('WHERE');
    sqlParts.push(whereClauses.map((clause) => `  ${clause}`).join('\n  AND '));
  }
  if (config.orderBy) {
    sqlParts.push(`ORDER BY ${config.orderBy}`);
  }
  if (enforcedLimit) {
    sqlParts.push('LIMIT ?');
    binds.push(enforcedLimit);
  }

  const sql = sqlParts.join('\n');

  return {
    sql,
    binds,
    metadata: {
      source: config.key,
      table: config.table,
      label: config.label,
      limit: enforcedLimit,
      filters: appliedFilters,
      includeAllColumns,
      selectedColumns: selectColumns === '*' ? ['*'] : config.defaultColumns,
    },
  };
}

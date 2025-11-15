import { PROCESSED_SALESLINE_TABLE } from '../constants/tables.js';

/**
 * Snowflake Queries - Comparación de ventas y costos
 * Autor: Sistema de Monitoreo D365
 * Descripción: Queries para comparar BASE (ERP_ACCOUNTING_TRANSACTION) vs VISTA (VW_VENTA_COSTO_LINEAS_TEST)
 */

/**
 * Query 1: Comparación POR CANAL (solo LEDGER 400000)
 * Compara totales por canal entre BASE y VISTA
 */
export const QUERY_COMPARACION_POR_CANAL = `
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
           'from', '2020-01-01',
           'to',   TO_CHAR(CURRENT_DATE() - 1, 'YYYY-MM-DD')
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

/**
 * Query 2: MISMATCH SUMMARY — Pedidos con diferencias
 * Identifica pedidos específicos con diferencias entre BASE y VISTA
 */
export const QUERY_MISMATCH_PEDIDOS = `
/* ============================================================
   MISMATCH SUMMARY — BASE (400000, signo invertido) vs VISTA (400000)
   Claves: CANAL, SALESID, INVOICEID
   Fechas / Tolerancia en UN SOLO LUGAR
   ============================================================ */
WITH
-- Cambia el rango y tolerancia solo aquí:
WINDOW_RAW AS (
  SELECT OBJECT_CONSTRUCT(
           'from', '2020-01-01',
           'to',   TO_CHAR(CURRENT_DATE() - 1, 'YYYY-MM-DD'),
           'tol',  0.005
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

export const QUERY_DETALLE_LINEAS_POR_SALESID = `
/* ============================================================
   DETALLE POR LÍNEA — ERP_PROCESSED_SALESLINE para un SalesId específico
   ============================================================ */
SELECT *
FROM ${PROCESSED_SALESLINE_TABLE}
WHERE TRIM(UPPER(SALESID)) = TRIM(UPPER(?))
ORDER BY LINECREATIONSEQUENCENUMBER;
`;

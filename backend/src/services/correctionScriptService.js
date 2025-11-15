import { NUMBER_TOLERANCE } from './mismatchAnalysis.js';
import { PROCESSED_SALESLINE_TABLE } from '../constants/tables.js';
import { buildProcessedPayload, PROCESSED_COLUMNS } from '../utils/processedLinePayload.js';

const SNOWFLAKE_PROCESSED_TABLE = PROCESSED_SALESLINE_TABLE;
const DEFAULT_DATAAREAID = process.env.DATAAREAID || null;

const COLUMN_TYPES = {
  QTY: 'number',
  SALESPRICE: 'number',
  ORIGINALPRICE: 'number',
  LINENUM: 'number',
  LINECREATIONSEQUENCENUMBER: 'number',
  LINEAMOUNT: 'number',
  LINEAMOUNTMST: 'number',
  LINEAMOUNTWITHTAXES: 'number',
  LINEAMOUNTTAX: 'number',
  LINEAMOUNTTAXMST: 'number',
  LINEDISC: 'number',
  LINEPERCENT: 'number',
  SUMLINEDISC: 'number',
  SUMLINEDISCMST: 'number',
  MULTILNDISC: 'number',
  MULTILNPERCENT: 'number',
  COSTAMOUNTADJUSTMENT: 'number',
  COSTAMOUNTPOSTED: 'number',
  COSTAMOUNTPHYSICAL: 'number',
  DISCPERCENT: 'number',
  CONTRIBUTIONMARGIN: 'number',
  CONTRIBUTIONRATIO: 'number',
  TENDERTYPEID: 'number',
  EXCHRATE: 'number',
  TAXAMOUNTMST: 'number',
  ITEMIDSCANNED: 'number',
  KEYBOARDITEMENTRY: 'number',
  PRICECHANGE: 'number',
  INVOICEDATE: 'date',
};

const INSERT_EXCLUDED_COLUMNS = new Set(['SNOWFLAKE_CREATED_AT', 'SNOWFLAKE_UPDATED_AT', 'SYNCSTARTDATETIME']);
const UPDATE_EXCLUDED_COLUMNS = new Set(['SALESLINEPK', ...INSERT_EXCLUDED_COLUMNS]);

const normalizeDateInput = (value) => {
  if (!value && value !== 0) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return value.toISOString().slice(0, 10);
  }
  const str = String(value).trim();
  if (!str) return null;
  const date = new Date(str);
  if (!Number.isNaN(date.getTime())) {
    return date.toISOString().slice(0, 10);
  }
  return str.slice(0, 10) || null;
};

const escapeSqlString = (value = '') => `'${String(value).replace(/'/g, "''")}'`;

const formatSqlValue = (column, rawValue) => {
  if (rawValue === null || rawValue === undefined) return 'NULL';
  const type = COLUMN_TYPES[column] || 'string';
  if (type === 'number') {
    const num = Number(rawValue);
    if (!Number.isFinite(num)) return 'NULL';
    return num.toString();
  }
  if (type === 'date') {
    const iso = normalizeDateInput(rawValue);
    return iso ? `'${iso}'::DATE` : 'NULL';
  }
  return escapeSqlString(rawValue);
};

const readField = (entity = {}, ...names) => {
  for (const key of names) {
    if (entity[key] === 0 || entity[key]) return entity[key];
  }
  return null;
};

const buildPayloadFromLine = (salesId, line) => {
  const raw = line?.odata?.raw || {};
  const overrides = {
    LINECREATIONSEQUENCENUMBER:
      line.lineNumber ?? readField(raw, 'LineCreationSequenceNumber', 'LINECREATIONSEQUENCENUMBER'),
    LINENUM: readField(raw, 'LineNum', 'LINENUM', 'LineNumber'),
    DATAAREAID: readField(raw, 'dataAreaId', 'DATAAREAID') || DEFAULT_DATAAREAID,
  };

  return buildProcessedPayload({
    salesId,
    odataRaw: raw,
    overrides,
  });
};

const normalizeNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const normalizeStringValue = (value) => {
  if (value === null || value === undefined) return '';
  return String(value).trim().toUpperCase();
};

const valuesEqual = (before, after, column) => {
  if (COLUMN_TYPES[column] === 'number') {
    const beforeNum = normalizeNumber(before);
    const afterNum = normalizeNumber(after);
    if (beforeNum === null && afterNum === null) return true;
    if (beforeNum === null || afterNum === null) return false;
    return Math.abs(beforeNum - afterNum) <= NUMBER_TOLERANCE;
  }
  if (COLUMN_TYPES[column] === 'date') {
    const beforeDate = normalizeDateInput(before);
    const afterDate = normalizeDateInput(after);
    return beforeDate === afterDate;
  }
  return normalizeStringValue(before) === normalizeStringValue(after);
};

const buildSqlInsertParts = (payload) => {
  const columns = [];
  const values = [];
  PROCESSED_COLUMNS.forEach((column) => {
    if (INSERT_EXCLUDED_COLUMNS.has(column)) return;
    const value = payload[column];
    if (value === undefined) return;
    columns.push(column);
    values.push(formatSqlValue(column, value));
  });
  return { columns, values };
};

const buildRollbackDelete = (salesLinePk) =>
  [`-- Rollback de inserción para SalesLinePk ${salesLinePk}`, `DELETE FROM ${SNOWFLAKE_PROCESSED_TABLE}`, `WHERE SALESLINEPK = ${formatSqlValue('SALESLINEPK', salesLinePk)};`].join('\n');

export const buildInsertStatements = (salesId, lines = []) =>
  lines
    .filter((line) => line.status === 'MISSING_IN_SNOWFLAKE' && line.odata?.raw)
    .map((line) => {
      const payload = buildPayloadFromLine(salesId, line);
      if (!payload.SALESLINEPK || payload.SALESLINEPK.replace(/-/g, '').trim() === '') {
        return {
          kind: 'insert',
          lineNumber: line.lineNumber,
          reason: 'MISSING_IN_SNOWFLAKE',
          sql: '-- No se pudo generar INSERT: SALESLINEPK incompleto',
          rollbackSql: '-- N/A',
          preview: { salesLinePk: null, warning: 'Faltan datos para armar SALESLINEPK' },
        };
      }

      const { columns, values } = buildSqlInsertParts(payload);
      const sql = [
        `-- Inserción sugerida para SalesLinePk ${payload.SALESLINEPK}`,
        `INSERT INTO ${SNOWFLAKE_PROCESSED_TABLE}`,
        `  (${columns.join(', ')})`,
        'VALUES',
        `  (${values.join(', ')});`,
      ].join('\n');

      const rollbackSql = buildRollbackDelete(payload.SALESLINEPK);

      return {
        kind: 'insert',
        lineNumber: line.lineNumber,
        reason: 'MISSING_IN_SNOWFLAKE',
        sql,
        rollbackSql,
        preview: {
          salesLinePk: payload.SALESLINEPK,
          invoiceId: payload.INVOICEID,
          amount: payload.LINEAMOUNT,
          canal: payload.CANAL,
          dataAreaId: payload.DATAAREAID,
        },
      };
    });

export const buildUpdateStatements = (lines = []) => {
  const statements = [];

  lines.forEach((line) => {
    const snow = line.snowflake;
    const odata = line.odata;
    if (!snow?.raw || !odata?.raw) return;
    if (!snow.raw.SALESLINEPK) return;

    const currentPk = snow.raw.SALESLINEPK;
    const targetPayload = buildPayloadFromLine(
      odata.raw.SalesId || snow.raw.SALESID || '',
      line
    );
    const setClauses = [];
    const rollbackClauses = [];
    const affectedColumns = [];

    if (targetPayload.SALESLINEPK !== currentPk) {
      // Cambiar el PK implicaría recrear la fila completa.
      statements.push({
        kind: 'update',
        lineNumber: line.lineNumber,
        reason: 'PK_MISMATCH',
        entryId: currentPk,
        actionable: false,
        sql: '-- No se generó UPDATE porque el SALESLINEPK objetivo difiere del actual. Se recomienda insertar una nueva línea.',
        rollbackSql: '-- N/A',
        affectedColumns: [],
        preview: {
          salesLinePk: currentPk,
          nuevoSalesLinePk: targetPayload.SALESLINEPK,
        },
      });
      return;
    }

    PROCESSED_COLUMNS.forEach((column) => {
      if (UPDATE_EXCLUDED_COLUMNS.has(column)) return;
      const desiredValue = targetPayload[column];
      if (desiredValue === undefined) return;
      const currentValue = snow.raw[column];
      if (valuesEqual(currentValue, desiredValue, column)) return;
      setClauses.push(`${column} = ${formatSqlValue(column, desiredValue)}`);
      rollbackClauses.push(`${column} = ${formatSqlValue(column, currentValue)}`);
      affectedColumns.push(column);
    });

    if (!setClauses.length) return;

    const sql = [
      `-- Corrección sugerida para SalesLinePk ${currentPk} · Línea ${line.lineNumber}`,
      `UPDATE ${SNOWFLAKE_PROCESSED_TABLE}`,
      'SET',
      `  ${setClauses.join(',\n  ')}`,
      `WHERE SALESLINEPK = ${formatSqlValue('SALESLINEPK', currentPk)};`,
    ].join('\n');

    const rollbackSql = [
      `-- Rollback de corrección para SalesLinePk ${currentPk}`,
      `UPDATE ${SNOWFLAKE_PROCESSED_TABLE}`,
      'SET',
      `  ${rollbackClauses.join(',\n  ')}`,
      `WHERE SALESLINEPK = ${formatSqlValue('SALESLINEPK', currentPk)};`,
    ].join('\n');

    statements.push({
      kind: 'update',
      lineNumber: line.lineNumber,
      reason: line.status,
      entryId: currentPk,
      actionable: true,
      sql,
      rollbackSql,
      affectedColumns,
      preview: {
        salesLinePk: currentPk,
        columnas: affectedColumns,
        antes: {
          amount: snow.raw.LINEAMOUNT,
          invoiceId: snow.raw.INVOICEID,
          canal: snow.raw.CANAL,
        },
        despues: {
          amount: targetPayload.LINEAMOUNT,
          invoiceId: targetPayload.INVOICEID,
          canal: targetPayload.CANAL,
        },
      },
    });
  });

  return statements;
};

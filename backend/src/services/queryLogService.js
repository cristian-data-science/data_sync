import { executeSnowflakeQuery } from './snowflakeService.js';

const LOG_TABLE_NAME = 'ZLOGS_QUERYS';
const LOG_COLUMNS = [
  'LOG_ID',
  'EXECUTED_AT',
  'ACTION_TYPE',
  'KIND',
  'SALES_ID',
  'LINE_NUMBER',
  'ENTRY_ID',
  'EXECUTED_SQL',
  'ROLLBACK_SQL',
  'EXECUTED_BY',
  'EXTRA_METADATA',
].join(', ');
const MAX_PAGE_SIZE = 200;
let logTableEnsured = false;

const CREATE_LOG_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS ${LOG_TABLE_NAME} (
  LOG_ID NUMBER AUTOINCREMENT START 1 INCREMENT 1,
  EXECUTED_AT TIMESTAMP_LTZ DEFAULT CURRENT_TIMESTAMP(),
  ACTION_TYPE STRING,
  KIND STRING,
  SALES_ID STRING,
  LINE_NUMBER NUMBER,
  ENTRY_ID STRING,
  EXECUTED_SQL STRING,
  ROLLBACK_SQL STRING,
  EXECUTED_BY STRING,
  EXTRA_METADATA VARIANT
);
`;

const INSERT_LOG_SQL = `
INSERT INTO ${LOG_TABLE_NAME} (
  ACTION_TYPE,
  KIND,
  SALES_ID,
  LINE_NUMBER,
  ENTRY_ID,
  EXECUTED_SQL,
  ROLLBACK_SQL,
  EXECUTED_BY,
  EXTRA_METADATA
)
SELECT ?, ?, ?, ?, ?, ?, ?, ?, PARSE_JSON(?)
`;

async function ensureLogTableExists() {
  if (logTableEnsured) return;
  await executeSnowflakeQuery(CREATE_LOG_TABLE_SQL);
  logTableEnsured = true;
}

const safeJsonStringify = (value) => {
  try {
    return JSON.stringify(value ?? {});
  } catch (error) {
    console.warn('No se pudo serializar metadata para ZLOGS_QUERYS, se enviará objeto vacío.', error);
    return '{}';
  }
};

const normalizeLogRow = (row = {}) => ({
  logId: row.LOG_ID ?? null,
  executedAt: row.EXECUTED_AT ?? null,
  actionType: row.ACTION_TYPE ?? null,
  kind: row.KIND ?? null,
  salesId: row.SALES_ID ?? null,
  lineNumber: row.LINE_NUMBER ?? null,
  entryId: row.ENTRY_ID ?? null,
  executedSql: row.EXECUTED_SQL ?? null,
  rollbackSql: row.ROLLBACK_SQL ?? null,
  executedBy: row.EXECUTED_BY ?? null,
  extraMetadata: row.EXTRA_METADATA ?? null,
});

const buildLogFilterClause = ({ salesId, actionType, kind } = {}) => {
  const clauses = [];
  const binds = [];

  if (salesId && String(salesId).trim()) {
    clauses.push('SALES_ID ILIKE ?');
    binds.push(`%${String(salesId).trim()}%`);
  }

  if (actionType && String(actionType).trim()) {
    clauses.push('ACTION_TYPE = ?');
    binds.push(String(actionType).trim());
  }

  if (kind && String(kind).trim()) {
    clauses.push('KIND = ?');
    binds.push(String(kind).trim());
  }

  const whereClause = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  return { whereClause, binds };
};

const sanitizePagination = ({ limit, offset } = {}) => {
  const parsedLimit = Number.parseInt(limit, 10);
  const parsedOffset = Number.parseInt(offset, 10);
  const safeLimit = Math.min(Math.max(Number.isFinite(parsedLimit) ? parsedLimit : 50, 1), MAX_PAGE_SIZE);
  const safeOffset = Math.max(Number.isFinite(parsedOffset) ? parsedOffset : 0, 0);
  return { limit: safeLimit, offset: safeOffset };
};

export async function logQueryExecution({
  actionType = 'sql',
  executedSql,
  rollbackSql = null,
  metadata = {},
  executedBy = null,
} = {}) {
  if (!executedSql) {
    console.warn('logQueryExecution llamado sin SQL ejecutado. Se omite el registro.');
    return;
  }

  await ensureLogTableExists();

  const jsonMetadata = safeJsonStringify(metadata);
  const binds = [
    actionType,
    metadata?.kind ?? null,
    metadata?.salesId ?? metadata?.SalesId ?? null,
    metadata?.lineNumber ?? null,
    metadata?.entryId ?? metadata?.entryID ?? metadata?.preview?.salesLinePk ?? null,
    executedSql,
    rollbackSql ?? metadata?.rollbackSql ?? null,
    executedBy ?? metadata?.executedBy ?? process.env.LOG_EXECUTOR ?? 'ui',
    jsonMetadata,
  ];

  await executeSnowflakeQuery(INSERT_LOG_SQL, binds);
}

export async function fetchQueryLogs(filters = {}) {
  await ensureLogTableExists();
  const { whereClause, binds } = buildLogFilterClause(filters);
  const { limit, offset } = sanitizePagination(filters);
  const sql = `SELECT ${LOG_COLUMNS}
FROM ${LOG_TABLE_NAME}
${whereClause}
ORDER BY EXECUTED_AT DESC
LIMIT ${limit}
OFFSET ${offset}`;
  const rows = await executeSnowflakeQuery(sql, binds);
  return {
    logs: rows.map(normalizeLogRow),
    limit,
    offset,
  };
}

export async function countQueryLogs(filters = {}) {
  await ensureLogTableExists();
  const { whereClause, binds } = buildLogFilterClause(filters);
  const sql = `SELECT COUNT(*) AS TOTAL FROM ${LOG_TABLE_NAME} ${whereClause}`;
  const rows = await executeSnowflakeQuery(sql, binds);
  return Number(rows?.[0]?.TOTAL || 0);
}

export async function fetchLogById(logId) {
  const numericId = Number.parseInt(logId, 10);
  if (!Number.isFinite(numericId) || numericId <= 0) return null;
  await ensureLogTableExists();
  const sql = `SELECT ${LOG_COLUMNS} FROM ${LOG_TABLE_NAME} WHERE LOG_ID = ?`;
  const rows = await executeSnowflakeQuery(sql, [numericId]);
  return rows.length ? normalizeLogRow(rows[0]) : null;
}

export { LOG_TABLE_NAME };

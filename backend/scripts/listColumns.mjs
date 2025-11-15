import { executeSnowflakeQuery } from '../src/services/snowflakeService.js';

const [table = 'ERP_ACCOUNTING_TRANSACTION', schema = 'CORE_TEST'] = process.argv.slice(2);

const sql = `
  SELECT COLUMN_NAME
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = '${schema.toUpperCase()}'
    AND TABLE_NAME = '${table.toUpperCase()}'
  ORDER BY ORDINAL_POSITION
`;

try {
  const rows = await executeSnowflakeQuery(sql);
  console.log(rows.map((row) => row.COLUMN_NAME));
} catch (error) {
  console.error('Failed to list columns:', error.message);
  process.exitCode = 1;
}

import { executeSnowflakeQuery } from '../../../backend/src/services/snowflakeService.js';
import { buildLineDownloadQuery } from '../../../backend/src/queries/snowflake-queries.js';

export const config = {
  api: {
    responseLimit: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ success: false, message: 'Método no permitido' });
  }

  try {
    const totalStart = Date.now();
    const { source, limit, includeAllColumns, ...rawFilters } = req.query || {};
    const includeAllFlag = String(includeAllColumns).toLowerCase() === 'true';

    const buildStart = Date.now();
    const { sql, binds, metadata } = buildLineDownloadQuery({
      source,
      limit,
      filters: rawFilters,
      includeAllColumns: includeAllFlag,
    });
    const buildMs = Date.now() - buildStart;

    console.log('[LineDownload] Ejecutando query', {
      source: metadata.source,
      table: metadata.table,
      limit: metadata.limit,
      filters: metadata.filters,
      includeAllColumns: metadata.includeAllColumns,
      sqlPreview: sql.slice(0, 200).replace(/\s+/g, ' '),
    });

    const queryStart = Date.now();
    const rows = await executeSnowflakeQuery(sql, binds);
    const queryMs = Date.now() - queryStart;
    const payloadStart = Date.now();
    const columns = rows.length ? Object.keys(rows[0]) : [];

    const responsePayload = {
      success: true,
      count: rows.length,
      data: rows,
      source: metadata.source,
      table: metadata.table,
      limit: metadata.limit,
      filters: metadata.filters,
      columns,
      timestamp: new Date().toISOString(),
      metrics: {
        buildMs,
        queryMs,
        payloadBuildMs: Date.now() - payloadStart,
        totalMs: Date.now() - totalStart,
        includeAllColumns: metadata.includeAllColumns,
        columnCount: columns.length,
      },
    };

    res.json(responsePayload);
  } catch (error) {
    console.error('[LineDownload] Error ejecutando query', {
      message: error.message,
      stack: error.stack,
    });
    const statusCode = error.message?.includes('rango de fechas') ? 400 : 500;
    res.status(statusCode).json({ success: false, message: error.message || 'Error obteniendo líneas' });
  }
}

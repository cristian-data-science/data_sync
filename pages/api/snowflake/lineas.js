import { executeSnowflakeQuery } from '../../../backend/src/services/snowflakeService.js';
import { buildLineDownloadQuery } from '../../../backend/src/queries/snowflake-queries.js';

export const config = {
  api: {
    responseLimit: false,
  },
};

const STREAMING_ROW_THRESHOLD = 200000;

function streamCsvResponse(res, rows) {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="download.csv"');

  if (!rows.length) {
    res.end();
    return;
  }

  // Add BOM so Excel recognizes UTF-8 automatically
  res.write('\uFEFF');

  const columns = Object.keys(rows[0]);
  // Use semicolon (;) for better compatibility with Spanish Excel (avoids conflict with decimal comma)
  res.write(columns.join(';') + '\n');

  rows.forEach((row) => {
    const line = columns.map(col => {
      let val = row[col];
      if (val === null || val === undefined) return '';
      val = String(val);
      // Escape if value contains delimiter (;), quote ("), or newline
      if (val.includes(';') || val.includes('"') || val.includes('\n')) {
        val = `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    }).join(';');
    res.write(line + '\n');
  });

  res.end();
}

function streamLargeResponse(res, payload, rows) {
  const { data: _ignored, ...meta } = payload;
  const metaJson = JSON.stringify(meta);
  const prefix = `${metaJson.slice(0, -1)},"data":[`;

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.write(prefix);

  rows.forEach((row, index) => {
    const rowChunk = JSON.stringify(row);
    res.write(rowChunk);
    if (index < rows.length - 1) {
      res.write(',');
    }
  });

  res.write(']}');
  res.end();
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ success: false, message: 'Método no permitido' });
  }

  try {
    const totalStart = Date.now();
    const { source, limit, includeAllColumns, format, ...rawFilters } = req.query || {};
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
      format,
      sqlPreview: sql.slice(0, 200).replace(/\s+/g, ' '),
    });

    const queryStart = Date.now();
    const rows = await executeSnowflakeQuery(sql, binds);
    const queryMs = Date.now() - queryStart;
    
    if (format === 'csv') {
      return streamCsvResponse(res, rows);
    }

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

    if (rows.length > STREAMING_ROW_THRESHOLD) {
      streamLargeResponse(res, responsePayload, rows);
    } else {
      res.json(responsePayload);
    }
  } catch (error) {
    console.error('[LineDownload] Error ejecutando query', {
      message: error.message,
      stack: error.stack,
    });
    const statusCode = error.message?.includes('rango de fechas') ? 400 : 500;
    res.status(statusCode).json({ success: false, message: error.message || 'Error obteniendo líneas' });
  }
}

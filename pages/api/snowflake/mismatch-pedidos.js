import { executeSnowflakeQuery } from '../../../backend/src/services/snowflakeService.js';
import { buildMismatchPedidosQuery } from '../../../backend/src/queries/snowflake-queries.js';

const DEFAULT_DATE_FROM = '2020-01-01';

const getYesterdayISO = () => {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return date.toISOString().slice(0, 10);
};

const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;

function getDateRange(query = {}) {
  const requestedFrom = typeof query.from === 'string' && isoDateRegex.test(query.from) ? query.from : null;
  const requestedTo = typeof query.to === 'string' && isoDateRegex.test(query.to) ? query.to : null;

  const from = requestedFrom || DEFAULT_DATE_FROM;
  const to = requestedTo || getYesterdayISO();

  if (from > to) {
    throw new Error('El rango de fechas es inválido (desde debe ser anterior o igual a hasta)');
  }

  return { from, to };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ success: false, message: 'Método no permitido' });
  }
  try {
    const dateRange = getDateRange(req.query);
    const query = buildMismatchPedidosQuery({ fromDate: dateRange.from, toDate: dateRange.to });
    const results = await executeSnowflakeQuery(query);
    res.json({
      success: true,
      count: results.length,
      data: results,
      query: 'MISMATCH_PEDIDOS',
      filters: dateRange,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const statusCode = error.message?.includes('rango de fechas') ? 400 : 500;
    res.status(statusCode).json({ success: false, message: error.message || 'Error ejecutando búsqueda de pedidos con diferencias' });
  }
}

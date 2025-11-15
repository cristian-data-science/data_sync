import { executeSnowflakeQuery } from '../../../backend/src/services/snowflakeService.js';
import { QUERY_MISMATCH_PEDIDOS } from '../../../backend/src/queries/snowflake-queries.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ success: false, message: 'Método no permitido' });
  }
  try {
    const results = await executeSnowflakeQuery(QUERY_MISMATCH_PEDIDOS);
    res.json({ success: true, count: results.length, data: results, query: 'MISMATCH_PEDIDOS', timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error ejecutando búsqueda de pedidos con diferencias', error: error.message });
  }
}

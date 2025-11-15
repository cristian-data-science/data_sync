import { executeSnowflakeQuery } from '../../../backend/src/services/snowflakeService.js';
import { QUERY_COMPARACION_POR_CANAL } from '../../../backend/src/queries/snowflake-queries.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ success: false, message: 'Método no permitido' });
  }
  try {
    const results = await executeSnowflakeQuery(QUERY_COMPARACION_POR_CANAL);
    res.json({ success: true, count: results.length, data: results, query: 'COMPARACION_POR_CANAL', timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error ejecutando comparación por canal', error: error.message });
  }
}

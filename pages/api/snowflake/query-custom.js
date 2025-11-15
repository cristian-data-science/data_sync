import { executeSnowflakeQuery } from '../../../backend/src/services/snowflakeService.js';
import { logQueryExecution } from '../../../backend/src/services/queryLogService.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ success: false, message: 'Método no permitido' });
  }
  try {
    const { query, rollbackSql = null, actionType = 'sql', metadata = {}, executedBy = null } = req.body || {};
    if (!query) return res.status(400).json({ success: false, message: 'Query SQL es requerida en el body' });
    const results = await executeSnowflakeQuery(query);
    try {
      await logQueryExecution({ actionType, executedSql: query, rollbackSql, metadata, executedBy });
    } catch {}
    res.json({ success: true, count: results.length, data: results, timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error ejecutando query personalizada', error: error.message });
  }
}

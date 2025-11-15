import { fetchQueryLogs, countQueryLogs } from '../../../../backend/src/services/queryLogService.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ success: false, message: 'Método no permitido' });
  }
  try {
    const filters = { salesId: req.query.salesId, actionType: req.query.actionType, kind: req.query.kind, limit: req.query.limit, offset: req.query.offset };
    const [{ logs, limit, offset }, total] = await Promise.all([fetchQueryLogs(filters), countQueryLogs(filters)]);
    res.json({ success: true, logs, total, limit, offset, timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ success: false, message: 'No se pudieron recuperar los logs', error: error.message });
  }
}

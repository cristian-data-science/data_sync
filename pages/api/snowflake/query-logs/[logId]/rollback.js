import { executeSnowflakeQuery } from '../../../../../backend/src/services/snowflakeService.js';
import { logQueryExecution, fetchLogById } from '../../../../../backend/src/services/queryLogService.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ success: false, message: 'Método no permitido' });
  }
  try {
    const logId = Number.parseInt(req.query.logId, 10);
    if (!Number.isFinite(logId) || logId <= 0) return res.status(400).json({ success: false, message: 'logId inválido' });
    const logEntry = await fetchLogById(logId);
    if (!logEntry) return res.status(404).json({ success: false, message: 'Log no encontrado' });
    const rollbackSql = (logEntry.rollbackSql || '').trim();
    if (!rollbackSql || rollbackSql === '-- N/A') return res.status(400).json({ success: false, message: 'Este log no tiene rollback disponible' });
    const results = await executeSnowflakeQuery(rollbackSql);
    try {
      await logQueryExecution({ actionType: 'rollback-from-log', executedSql: rollbackSql, rollbackSql: null, metadata: { sourceLogId: logEntry.logId, salesId: logEntry.salesId, entryId: logEntry.entryId, originalActionType: logEntry.actionType }, executedBy: req.body?.executedBy || null });
    } catch {}
    res.json({ success: true, message: 'Rollback ejecutado desde el log', rows: results.length, sourceLogId: logEntry.logId, timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ success: false, message: 'No se pudo ejecutar el rollback solicitado', error: error.message });
  }
}

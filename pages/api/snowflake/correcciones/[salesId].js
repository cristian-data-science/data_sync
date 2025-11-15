import { analyzeSalesIdMismatch } from '../../../../backend/src/services/mismatchAnalysis.js';
import { buildInsertStatements, buildUpdateStatements } from '../../../../backend/src/services/correctionScriptService.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ success: false, message: 'Método no permitido' });
  }
  try {
    const salesId = (req.query.salesId || '').trim();
    if (!salesId) return res.status(400).json({ success: false, message: 'salesId requerido' });
    const { report } = await analyzeSalesIdMismatch(salesId);
    const inserts = buildInsertStatements(salesId, report.lines);
    const updates = buildUpdateStatements(report.lines);
    res.json({ success: true, salesId, summary: report.summary, generatedAt: new Date().toISOString(), inserts, updates });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error generando scripts de corrección', error: error.message });
  }
}

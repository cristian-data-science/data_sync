import { analyzeSalesIdMismatch } from '../../../../backend/src/services/mismatchAnalysis.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ success: false, message: 'Método no permitido' });
  }
  try {
    const salesId = (req.query.salesId || '').trim();
    if (!salesId) return res.status(400).json({ success: false, message: 'salesId requerido' });
    const { report } = await analyzeSalesIdMismatch(salesId);
    res.json({ success: true, ...report });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error analizando diferencias del pedido', error: error.message });
  }
}

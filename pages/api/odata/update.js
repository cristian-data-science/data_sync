import { patchODataRecord } from '../../../backend/src/services/odataService.js';

export default async function handler(req, res) {
  if (req.method !== 'PATCH') {
    res.setHeader('Allow', 'PATCH');
    return res.status(405).json({ error: 'Método no permitido' });
  }
  try {
    const { salesId, changes } = req.body || {};
    if (!salesId || !changes || typeof changes !== 'object') return res.status(400).json({ error: 'salesId y changes requeridos' });
    const resp = await patchODataRecord(salesId, changes);
    return res.status(resp.status || 200).json({ status: resp.status || 200, ok: true });
  } catch (err) {
    if (err.response) {
      const { status, data, headers } = err.response;
      return res.status(status || 500).json({ status, content_type: headers?.['content-type'], text: typeof data === 'string' ? data.slice(0, 1000) : data });
    }
    return res.status(500).json({ error: err.message });
  }
}

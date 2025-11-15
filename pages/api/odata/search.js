import { fetchODataBySalesId } from '../../../backend/src/services/odataService.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Método no permitido' });
  }
  try {
    const salesId = req.query.salesId || '';
    if (!salesId) return res.status(400).json({ error: 'salesId requerido' });
    const data = await fetchODataBySalesId(salesId);
    return res.json(data);
  } catch (err) {
    if (err.response) {
      const { status, data, headers } = err.response;
      return res.status(status || 500).json({ status, content_type: headers?.['content-type'], text: typeof data === 'string' ? data.slice(0, 1000) : data });
    }
    return res.status(500).json({ error: err.message });
  }
}

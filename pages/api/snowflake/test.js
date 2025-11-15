import { testSnowflakeConnection } from '../../../backend/src/services/snowflakeService.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ success: false, message: 'Método no permitido' });
  }
  try {
    const result = await testSnowflakeConnection();
    res.json({ success: true, message: 'Conexión exitosa a Snowflake', data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error de conexión a Snowflake', error: error.message });
  }
}

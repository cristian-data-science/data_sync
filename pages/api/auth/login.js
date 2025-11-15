import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Buffer } from 'buffer';

/**
 * API endpoint para autenticación de usuarios
 * POST /api/auth/login
 * 
 * Body: { username: string, password: string }
 * Response: { success: true, token: string, user: { username, name } }
 */
export default async function handler(req, res) {
  // Solo permitir método POST
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      message: 'Método no permitido' 
    });
  }

  try {
    const { username, password } = req.body;

    // Validar que se recibieron las credenciales
    if (!username || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Usuario y contraseña son requeridos' 
      });
    }

    // Obtener credenciales del admin desde variables de entorno
    const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
    const ADMIN_PASSWORD_HASH_BASE64 = process.env.ADMIN_PASSWORD_HASH_BASE64;
    let ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH;
    
    // Permitir almacenar el hash en base64 para evitar expansión de $ en .env
    if (!ADMIN_PASSWORD_HASH && ADMIN_PASSWORD_HASH_BASE64) {
      ADMIN_PASSWORD_HASH = Buffer.from(ADMIN_PASSWORD_HASH_BASE64, 'base64').toString('utf8');
    }
    const JWT_SECRET = process.env.JWT_SECRET;

    // DEBUG: Logs para debugging
    console.log('🔍 Login attempt:', { username, passwordLength: password?.length });
    console.log('🔍 Expected username:', ADMIN_USERNAME);
    console.log('🔍 Hash configured:', ADMIN_PASSWORD_HASH ? 'Yes' : 'No');
    console.log('🔍 Hash value:', ADMIN_PASSWORD_HASH?.substring(0, 20) + '...');

    // Validar que las variables de entorno estén configuradas
    if (!ADMIN_PASSWORD_HASH) {
      console.error('❌ ADMIN_PASSWORD_HASH no está configurado en .env');
      return res.status(500).json({ 
        success: false, 
        message: 'Error de configuración del servidor' 
      });
    }

    if (!JWT_SECRET) {
      console.error('❌ JWT_SECRET no está configurado en .env');
      return res.status(500).json({ 
        success: false, 
        message: 'Error de configuración del servidor' 
      });
    }

    // Verificar que el usuario sea el admin
    if (username !== ADMIN_USERNAME) {
      console.log('❌ Username mismatch');
      // Agregar un pequeño delay para prevenir timing attacks
      await new Promise(resolve => setTimeout(resolve, 500));
      return res.status(401).json({ 
        success: false, 
        message: 'Credenciales inválidas' 
      });
    }

    // Validar la contraseña con bcrypt
    console.log('🔍 Comparing password with hash...');
    const isPasswordValid = await bcrypt.compare(password, ADMIN_PASSWORD_HASH);
    console.log('🔍 Password valid:', isPasswordValid);

    if (!isPasswordValid) {
      console.log('❌ Password validation failed');
      return res.status(401).json({ 
        success: false, 
        message: 'Credenciales inválidas' 
      });
    }

    // Generar el token JWT
    const user = {
      username: ADMIN_USERNAME,
      name: 'Administrador'
    };

    const token = jwt.sign(
      { 
        username: user.username,
        name: user.name,
        // Agregar timestamp para invalidar tokens antiguos si es necesario
        iat: Math.floor(Date.now() / 1000)
      },
      JWT_SECRET,
      { 
        expiresIn: '24h' // Token válido por 24 horas
      }
    );

    // Retornar éxito con el token
    return res.status(200).json({
      success: true,
      token,
      user: {
        username: user.username,
        name: user.name
      }
    });

  } catch (error) {
    console.error('Error en login:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Error interno del servidor' 
    });
  }
}

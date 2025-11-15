import jwt from 'jsonwebtoken';

/**
 * Middleware para validar tokens JWT en las peticiones
 * 
 * @param {Function} handler - El handler de la ruta a proteger
 * @returns {Function} Handler envuelto con validación de JWT
 */
export function withAuth(handler) {
  return async (req, res) => {
    try {
      // Obtener el token del header Authorization
      const authHeader = req.headers.authorization;
      
      if (!authHeader) {
        return res.status(401).json({ 
          success: false, 
          message: 'No se proporcionó token de autenticación' 
        });
      }

      // El formato esperado es: "Bearer TOKEN"
      const token = authHeader.startsWith('Bearer ') 
        ? authHeader.substring(7) 
        : authHeader;

      if (!token) {
        return res.status(401).json({ 
          success: false, 
          message: 'Token de autenticación inválido' 
        });
      }

      // Validar el token
      const JWT_SECRET = process.env.JWT_SECRET;
      
      if (!JWT_SECRET) {
        console.error('❌ JWT_SECRET no está configurado en .env');
        return res.status(500).json({ 
          success: false, 
          message: 'Error de configuración del servidor' 
        });
      }

      const decoded = jwt.verify(token, JWT_SECRET);
      
      // Agregar la información del usuario al request
      req.user = {
        username: decoded.username,
        name: decoded.name
      };

      // Ejecutar el handler original
      return handler(req, res);

    } catch (error) {
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({ 
          success: false, 
          message: 'Token inválido' 
        });
      }
      
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({ 
          success: false, 
          message: 'Token expirado' 
        });
      }

      console.error('Error en validación de token:', error);
      return res.status(500).json({ 
        success: false, 
        message: 'Error interno del servidor' 
      });
    }
  };
}

/**
 * Función helper para verificar un token sin usar como middleware
 * 
 * @param {string} token - El token JWT a verificar
 * @returns {Object|null} Los datos del usuario o null si es inválido
 */
export function verifyToken(token) {
  try {
    const JWT_SECRET = process.env.JWT_SECRET;
    
    if (!JWT_SECRET) {
      console.error('❌ JWT_SECRET no está configurado en .env');
      return null;
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    return {
      username: decoded.username,
      name: decoded.name
    };
  } catch (error) {
    console.error('Error al verificar token:', error.message);
    return null;
  }
}

/**
 * Función helper para generar un nuevo token
 * 
 * @param {Object} user - Objeto con los datos del usuario
 * @returns {string} El token JWT generado
 */
export function generateToken(user) {
  const JWT_SECRET = process.env.JWT_SECRET;
  
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET no está configurado en .env');
  }

  return jwt.sign(
    { 
      username: user.username,
      name: user.name,
      iat: Math.floor(Date.now() / 1000)
    },
    JWT_SECRET,
    { 
      expiresIn: '24h'
    }
  );
}

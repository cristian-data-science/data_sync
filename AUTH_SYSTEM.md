# Sistema de Autenticación JWT

## Descripción General

Sistema de autenticación profesional basado en JWT (JSON Web Tokens) con validación de contraseñas usando bcrypt. Diseñado para producción con seguridad de nivel empresarial.

## Componentes Principales

### 1. AuthContext (`contexts/AuthContext.jsx`)

Provee el estado de autenticación global:
- `user`: Información del usuario autenticado
- `token`: JWT token de sesión
- `login(username, password)`: Función para iniciar sesión (llama al API)
- `logout()`: Función para cerrar sesión
- `getAuthHeader()`: Helper para obtener headers de autenticación
- `isAuthenticated`: Boolean indicando si hay sesión activa
- `loading`: Estado de carga inicial

### 2. API de Autenticación (`pages/api/auth/login.js`)

Endpoint POST `/api/auth/login`:
- Valida credenciales contra variables de entorno
- Compara password con hash bcrypt
- Genera token JWT con expiración de 24h
- Retorna token y datos de usuario
- Implementa delays para prevenir timing attacks

### 3. Middleware de Autenticación (`utils/auth.js`)

Utilidades para proteger rutas:
- `withAuth(handler)`: HOC para proteger endpoints API
- `verifyToken(token)`: Verifica y decodifica JWT
- `generateToken(user)`: Genera nuevo JWT token

### 4. Página de Login (`pages/login.jsx`)

- Formulario de login con validación
- Diseño coherente con el resto de la app (Chakra UI)
- Manejo de errores con toasts
- Redirección automática al dashboard tras login exitoso
- Soporte para modo oscuro

### 5. ProtectedRoute (en `pages/_app.js`)

- HOC que envuelve las rutas protegidas
- Redirige a `/login` si no hay sesión activa
- Muestra spinner mientras verifica la autenticación

## Configuración de Credenciales

### 1. Variables de Entorno (.env)

```bash
# JWT Secret (mínimo 32 caracteres aleatorios)
# Genera con: openssl rand -base64 32
JWT_SECRET=tu-secret-key-super-segura-cambiar-en-produccion-min-32-caracteres

# Credenciales Admin
ADMIN_USERNAME=admin
ADMIN_PASSWORD_HASH_BASE64=hash.bcrypt.en.base64
```

### 2. Generar Hash de Contraseña

Usa el script incluido:

```bash
node scripts/generate-password-hash.js MiPasswordSegura123!
```

Esto generará un hash bcrypt que debes convertir a base64 para evitar problemas con el carácter `$`.

```bash
# Convierte el hash generado a base64
node scripts/encode-hash-base64.js "$2b$10$hashGenerado"
```

Finalmente pega el resultado en `ADMIN_PASSWORD_HASH_BASE64` dentro de tu `.env`.

## Seguridad

✅ **Características de Seguridad Implementadas**:

1. ✅ **Contraseñas hasheadas**: Usando bcrypt con 10 salt rounds
2. ✅ **JWT tokens**: Sesiones seguras sin estado en servidor
3. ✅ **Variables de entorno**: Sin credenciales hardcodeadas
4. ✅ **Timing attack protection**: Delays en validaciones fallidas
5. ✅ **Token expiration**: Tokens válidos por 24h
6. ✅ **HTTPS ready**: Compatible con despliegue seguro en Vercel
7. ✅ **Middleware de protección**: Para rutas API sensibles

### Mejoras Adicionales Recomendadas

Para casos de uso críticos:

1. **Rate limiting**: Implementar con `express-rate-limit` o similar
2. **Refresh tokens**: Sistema de renovación automática de tokens
3. **2FA**: Autenticación de dos factores
4. **Auditoría**: Logging de intentos de login
5. **Múltiples usuarios**: Sistema de gestión de usuarios en BD
6. **Roles y permisos**: RBAC (Role-Based Access Control)

## Flujo de Autenticación

1. Usuario accede a una ruta protegida
2. Si no está autenticado → redirige a `/login`
3. Usuario ingresa credenciales
4. Frontend llama a `POST /api/auth/login`
5. Backend valida username y compara password hash con bcrypt
6. Si es válido → genera JWT token y retorna con datos de usuario
7. Frontend guarda token y usuario en localStorage y state
8. Redirige automáticamente al dashboard
9. Peticiones subsecuentes incluyen header `Authorization: Bearer <token>`
10. Middleware `withAuth` valida el token en rutas protegidas

## Proteger Rutas API

Para proteger un endpoint API:

```javascript
import { withAuth } from '@/utils/auth';

async function handler(req, res) {
  // req.user contiene los datos del usuario autenticado
  const { username, name } = req.user;
  
  // Tu lógica aquí
  res.json({ message: 'Datos protegidos', user: req.user });
}

export default withAuth(handler);
```

## Persistencia

- **Token**: Guardado en `localStorage` con clave `auth_token`
- **Usuario**: Guardado en `localStorage` con clave `auth_user`
- La sesión persiste entre recargas del navegador
- Token expira automáticamente después de 24h

## Gestión de Tokens en Frontend

El `AuthContext` provee `getAuthHeader()` para incluir el token en peticiones:

```javascript
const { getAuthHeader } = useAuth();

const response = await fetch('/api/protected-route', {
  headers: {
    'Content-Type': 'application/json',
    ...getAuthHeader(), // Agrega Authorization: Bearer <token>
  },
});
```

## Debugging

Si tienes problemas:

1. Verifica que `.env` tenga `JWT_SECRET` y `ADMIN_PASSWORD_HASH_BASE64`
2. Regenera el hash con `node scripts/generate-password-hash.js`
3. Convierte el hash a base64 con `node scripts/encode-hash-base64.js`
3. Verifica que el token no haya expirado (24h)
4. Revisa la consola del navegador y logs del servidor
5. Prueba hacer logout y login nuevamente

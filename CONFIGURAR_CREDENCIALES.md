# Cómo Configurar las Credenciales de Login

## Sistema de Autenticación JWT con Bcrypt

Este proyecto usa autenticación profesional con:
- ✅ JWT tokens para sesiones seguras
- ✅ Bcrypt para hashing de contraseñas
- ✅ Variables de entorno (sin credenciales hardcodeadas)

## Configuración Inicial

### 1. Generar JWT Secret

Genera una clave secreta aleatoria:

**En Linux/Mac:**
```bash
openssl rand -base64 32
```

**En Windows (PowerShell):**
```powershell
-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | ForEach-Object {[char]$_})
```

**Alternativa (Node.js):**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Copia el resultado y agrégalo a tu archivo `.env`:

```bash
JWT_SECRET=tu-resultado-aqui-debe-ser-aleatorio-y-largo
```

### 2. Generar Hash de Contraseña

Usa el script incluido para generar el hash bcrypt de tu contraseña:

```bash
node scripts/generate-password-hash.js MiPasswordSegura123!
```

### 3. Convertir el Hash a Base64

Para evitar que el carácter `$` sea interpretado en el archivo `.env`, convierte el hash generado a base64:

```bash
node scripts/encode-hash-base64.js "$2b$10$hash.generado.en.el.paso.anterior"
```

**Ejemplo de salida:**
```
✅ Hash convertido a Base64:

JDJiJDEwJE...restoEnBase64

Copia este valor en ADMIN_PASSWORD_HASH_BASE64
```

### 4. Configurar Variables de Entorno

Edita tu archivo `.env` y agrega:

```bash
# Authentication Configuration
JWT_SECRET=tu-secret-key-generada-en-paso-1
ADMIN_USERNAME=admin
ADMIN_PASSWORD_HASH_BASE64=hash.bcrypt.convertido.a.base64
```

**Ejemplo completo:**
```bash
# Authentication Configuration
JWT_SECRET=xK9vN2pQ7mL4hR6wT3jF8yS1bV5nC0aE9uI7oP4kM6dG2hJ8
ADMIN_USERNAME=admin
ADMIN_PASSWORD_HASH_BASE64=JDJiJDEwJE...
```

### 4. Reiniciar el Servidor

```bash
npm run dev
```

## Cambiar Contraseña

Para cambiar la contraseña del admin:

1. Genera un nuevo hash con tu nueva contraseña:
   ```bash
   node scripts/generate-password-hash.js MiNuevaPassword456!
   ```

2. Copia el hash generado

3. Actualiza `ADMIN_PASSWORD_HASH` en `.env`

4. Reinicia el servidor

## Cambiar Usuario

Para cambiar el nombre de usuario:

1. Edita `ADMIN_USERNAME` en `.env`:
   ```bash
   ADMIN_USERNAME=miusuario
   ```

2. Reinicia el servidor

## Variables de Entorno Disponibles

```bash
# JWT Secret (mínimo 32 caracteres aleatorios)
JWT_SECRET=clave-secreta-aleatoria-muy-larga

# Nombre de usuario del administrador
ADMIN_USERNAME=admin

# Hash bcrypt de la contraseña (generado con el script)
ADMIN_PASSWORD_HASH=$2a$10$hash.bcrypt.aqui
```

## ⚠️ Seguridad

### ✅ Buenas Prácticas Implementadas

1. ✅ **Contraseñas hasheadas**: Nunca se guardan en texto plano
2. ✅ **Variables de entorno**: Credenciales fuera del código fuente
3. ✅ **JWT tokens**: Sesiones seguras con expiración
4. ✅ **.gitignore**: El archivo `.env` NO se sube a Git
5. ✅ **Ejemplo incluido**: `.env.example` como plantilla

### 🔒 Recomendaciones Adicionales

1. **Contraseñas fuertes**: Mínimo 12 caracteres, mayúsculas, minúsculas, números y símbolos
2. **JWT Secret único**: Genera uno diferente para cada entorno (dev, staging, prod)
3. **No compartir .env**: Cada desarrollador tiene su propio `.env`
4. **Rotación**: Cambia contraseñas periódicamente
5. **HTTPS**: Asegura que Vercel esté usando HTTPS (por defecto lo hace)

## Pasos para Configurar en Nuevo Entorno

### Desarrollo Local

1. Copia el archivo de ejemplo:
   ```bash
   cp .env.example .env
   ```

2. Genera JWT secret y actualiza `.env`

3. Genera password hash y actualiza `.env`

4. Verifica las otras variables (Dynamics 365, Snowflake, etc.)

5. Reinicia el servidor

### Producción (Vercel)

1. Ve a tu proyecto en Vercel Dashboard

2. Settings → Environment Variables

3. Agrega las variables:
   - `JWT_SECRET`: Tu secret generado
   - `ADMIN_USERNAME`: admin
   - `ADMIN_PASSWORD_HASH`: Tu hash generado
   - (más las otras variables de Dynamics 365 y Snowflake)

4. Redeploy el proyecto

## Troubleshooting

### Error: "JWT_SECRET no está configurado"

- Verifica que `.env` tenga la variable `JWT_SECRET`
- Reinicia el servidor después de agregar variables

### Error: "Credenciales inválidas"

- Verifica que el usuario sea exactamente igual (case-sensitive)
- Regenera el hash de la contraseña con el script
- Asegúrate de copiar el hash completo sin espacios

### Error: "Token expirado"

- Los tokens duran 24h
- Cierra sesión y vuelve a iniciar sesión

### No puedo generar el hash

- Verifica que bcryptjs esté instalado: `npm install bcryptjs`
- Ejecuta el script desde la raíz del proyecto

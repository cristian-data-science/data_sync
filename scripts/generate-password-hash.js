/**
 * Script para generar hashes bcrypt de contraseñas
 * Uso: node scripts/generate-password-hash.js tuContraseña
 */

const bcrypt = require('bcryptjs');

// Obtener la contraseña del argumento
const password = process.argv[2];

if (!password) {
  console.error('❌ Error: Debes proporcionar una contraseña');
  console.log('\nUso:');
  console.log('  node scripts/generate-password-hash.js tuContraseña');
  console.log('\nEjemplo:');
  console.log('  node scripts/generate-password-hash.js MiPassword123!');
  process.exit(1);
}

// Validar que la contraseña sea segura
if (password.length < 8) {
  console.error('❌ Error: La contraseña debe tener al menos 8 caracteres');
  process.exit(1);
}

// Generar el hash (10 rounds de salt)
const saltRounds = 10;
bcrypt.hash(password, saltRounds, (err, hash) => {
  if (err) {
    console.error('❌ Error al generar el hash:', err);
    process.exit(1);
  }

  console.log('\n✅ Hash generado exitosamente!\n');
  console.log('Copia este hash en tu archivo .env:');
  console.log('─'.repeat(80));
  console.log(hash);
  console.log('─'.repeat(80));
  console.log('\nEjemplo en .env:');
  console.log(`ADMIN_PASSWORD_HASH=${hash}`);
  console.log('\n⚠️  IMPORTANTE: Guarda este hash en tu .env y NUNCA compartas tu archivo .env');
});

/**
 * Script para convertir un hash bcrypt a base64.
 * Uso: node scripts/encode-hash-base64.js "$2b$10$hashAqui"
 */

const hash = process.argv[2];

if (!hash) {
  console.error('❌ Debes proporcionar el hash a convertir.');
  console.log('\nUso:');
  console.log('  node scripts/encode-hash-base64.js "$2b$10$hashAqui"');
  process.exit(1);
}

const base64 = Buffer.from(hash, 'utf8').toString('base64');

console.log('\n✅ Hash convertido a Base64:\n');
console.log(base64);
console.log('\nCopia este valor en ADMIN_PASSWORD_HASH_BASE64 dentro de tu archivo .env');

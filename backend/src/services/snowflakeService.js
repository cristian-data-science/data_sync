import snowflake from 'snowflake-sdk';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Configuración de Snowflake desde variables de entorno
 */
const normalizeAccount = (value = '') => {
  return value
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\.snowflakecomputing\.com$/i, '')
    .replace(/\/.*$/, '');
};

const snowflakeConfig = {
  account: normalizeAccount(process.env.SNOWFLAKE_ACCOUNT),
  username: process.env.SNOWFLAKE_USERNAME,
  password: process.env.SNOWFLAKE_PASSWORD,
  warehouse: process.env.SNOWFLAKE_WAREHOUSE,
  database: process.env.SNOWFLAKE_DATABASE,
  schema: process.env.SNOWFLAKE_SCHEMA,
  role: process.env.SNOWFLAKE_ROLE,
};

if (process.env.SNOWFLAKE_ACCOUNT && process.env.SNOWFLAKE_ACCOUNT !== snowflakeConfig.account) {
  console.log('Info: SNOWFLAKE_ACCOUNT normalizado a', snowflakeConfig.account);
}

/**
 * Ejecuta una query en Snowflake y retorna los resultados
 * @param {string} sqlText - Query SQL a ejecutar
 * @param {Array} [binds] - Parámetros para la query (bind variables)
 * @returns {Promise<Array>} - Array con los resultados
 */
export async function executeSnowflakeQuery(sqlText, binds = []) {
  return new Promise((resolve, reject) => {
    // Crear conexión
    const connection = snowflake.createConnection(snowflakeConfig);

    // Conectar
    connection.connect((err, conn) => {
      if (err) {
        console.error('Error conectando a Snowflake:', err.message);
        return reject(err);
      }

      console.log('✅ Conectado a Snowflake exitosamente');

      // Ejecutar query
      conn.execute({
        sqlText,
        binds,
        complete: (err, stmt, rows) => {
          // Cerrar conexión
          connection.destroy((destroyErr) => {
            if (destroyErr) {
              console.error('Error cerrando conexión Snowflake:', destroyErr.message);
            }
          });

          if (err) {
            console.error('❌ Error ejecutando query Snowflake:', err.message);
            return reject(err);
          }

          const safeRows = Array.isArray(rows) ? rows : [];
          const guardedCall = (fn) => {
            try {
              return typeof fn === 'function' ? fn.call(stmt) : undefined;
            } catch (error) {
              return undefined;
            }
          };
          const affectedSelect = guardedCall(stmt?.getNumRows);
          const affectedDml = guardedCall(stmt?.getNumUpdatedRows);
          const affectedLabel = affectedSelect ?? affectedDml ?? safeRows.length;
          console.log(`✅ Query ejecutada exitosamente. ${affectedLabel} filas afectadas/retornadas.`);
          resolve(safeRows);
        },
      });
    });
  });
}

/**
 * Valida que las credenciales de Snowflake estén configuradas
 */
export function validateSnowflakeConfig() {
  const required = [
    'SNOWFLAKE_ACCOUNT',
    'SNOWFLAKE_USERNAME',
    'SNOWFLAKE_PASSWORD',
    'SNOWFLAKE_WAREHOUSE',
    'SNOWFLAKE_DATABASE',
    'SNOWFLAKE_SCHEMA',
  ];

  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `❌ Faltan variables de entorno de Snowflake: ${missing.join(', ')}`
    );
  }

  console.log('✅ Configuración de Snowflake validada');
}

/**
 * Test de conexión a Snowflake
 */
export async function testSnowflakeConnection() {
  try {
    const result = await executeSnowflakeQuery('SELECT CURRENT_VERSION() AS VERSION, CURRENT_DATABASE() AS DB');
    console.log('✅ Test de conexión Snowflake exitoso:', result[0]);
    return result[0];
  } catch (error) {
    console.error('❌ Test de conexión Snowflake falló:', error.message);
    throw error;
  }
}

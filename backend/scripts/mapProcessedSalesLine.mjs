import 'dotenv/config';
import { fetchODataBySalesId } from '../src/services/odataService.js';
import { executeSnowflakeQuery } from '../src/services/snowflakeService.js';

const TARGET_TABLE = process.env.SNOWFLAKE_PROCESSED_TABLE || 'PATAGONIA.CORE_TEST.ERP_PROCESSED_SALESLINE';

const normalizeKey = (key = '') => key.toUpperCase().replace(/[^A-Z0-9]/g, '');

const sampleValue = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch (err) {
      return '[object]';
    }
  }
  const str = String(value);
  return str.length > 80 ? `${str.slice(0, 77)}...` : str;
};

const alignFields = (odataRows = [], snowRows = []) => {
  const odataKeys = new Map();
  const snowKeys = new Map();

  odataRows.forEach((row) => {
    Object.entries(row).forEach(([key, value]) => {
      if (!odataKeys.has(key)) {
        odataKeys.set(key, sampleValue(value));
      }
    });
  });

  snowRows.forEach((row) => {
    Object.entries(row).forEach(([key, value]) => {
      if (!snowKeys.has(key)) {
        snowKeys.set(key, sampleValue(value));
      }
    });
  });

  const snowIndex = new Map();
  Array.from(snowKeys.keys()).forEach((key) => {
    snowIndex.set(normalizeKey(key), key);
  });

  const mappings = [];
  const matchedSnow = new Set();

  odataKeys.forEach((value, key) => {
    const normalized = normalizeKey(key);
    const snowKey = snowIndex.get(normalizeKey(key));
    if (snowKey) matchedSnow.add(snowKey);
    mappings.push({
      odataField: key,
      odataSample: value,
      snowflakeField: snowKey || null,
      snowflakeSample: snowKey ? snowKeys.get(snowKey) : null,
    });
  });

  const snowflakeOnly = [];
  snowKeys.forEach((value, key) => {
    if (!matchedSnow.has(key)) {
      snowflakeOnly.push({ field: key, sample: value });
    }
  });

  return { mappings, snowflakeOnly };
};

const run = async () => {
  const salesId = (process.argv[2] || '').trim();
  if (!salesId) {
    console.error('Uso: node scripts/mapProcessedSalesLine.mjs <SalesId>');
    process.exitCode = 1;
    return;
  }

  try {
    const [odataResponse, snowRows] = await Promise.all([
      fetchODataBySalesId(salesId),
      executeSnowflakeQuery(
        `SELECT * FROM ${TARGET_TABLE} WHERE TRIM(UPPER(SALESID)) = TRIM(UPPER(?)) ORDER BY LINECREATIONSEQUENCENUMBER`,
        [salesId]
      ),
    ]);

    const odataRows = Array.isArray(odataResponse?.value) ? odataResponse.value : [];
    console.log(`OData filas: ${odataRows.length}`);
    console.log(`Snowflake filas: ${snowRows.length}`);

    const result = alignFields(odataRows, snowRows);
    console.log('\n=== MAPEOS PROPUESTOS ===');
    result.mappings.forEach((entry) => {
      console.log(`- ${entry.odataField} -> ${entry.snowflakeField || '[sin match]'}`);
    });

    if (result.snowflakeOnly.length) {
      console.log('\n=== CAMPOS SOLO EN SNOWFLAKE ===');
      result.snowflakeOnly.forEach((entry) => {
        console.log(`- ${entry.field}`);
      });
    }

    console.log('\n=== EJEMPLO JSON COMPLETO ===');
    console.log(
      JSON.stringify(
        {
          odataSample: odataRows[0] || null,
          snowflakeSample: snowRows[0] || null,
        },
        null,
        2
      )
    );
  } catch (error) {
    console.error('Error generando mapeo:', error.message);
    process.exitCode = 1;
  }
};

run();

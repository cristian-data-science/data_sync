import express from 'express';
import { executeSnowflakeQuery, testSnowflakeConnection } from '../services/snowflakeService.js';
import {
  QUERY_COMPARACION_POR_CANAL,
  QUERY_MISMATCH_PEDIDOS,
} from '../queries/snowflake-queries.js';
import { analyzeSalesIdMismatch } from '../services/mismatchAnalysis.js';
import { buildInsertStatements, buildUpdateStatements } from '../services/correctionScriptService.js';
import { logQueryExecution, fetchQueryLogs, countQueryLogs, fetchLogById } from '../services/queryLogService.js';

const router = express.Router();

/**
 * GET /api/snowflake/test
 * Test de conexión a Snowflake
 */
router.get('/test', async (req, res) => {
  try {
    const result = await testSnowflakeConnection();
    res.json({
      success: true,
      message: 'Conexión exitosa a Snowflake',
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error de conexión a Snowflake',
      error: error.message,
    });
  }
});

/**
 * GET /api/snowflake/comparacion-canal
 * Ejecuta la query de comparación por canal (BASE vs VISTA)
 */
router.get('/comparacion-canal', async (req, res) => {
  try {
    console.log('📊 Ejecutando comparación por canal...');
    const results = await executeSnowflakeQuery(QUERY_COMPARACION_POR_CANAL);
    
    res.json({
      success: true,
      count: results.length,
      data: results,
      query: 'COMPARACION_POR_CANAL',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error en comparación por canal:', error);
    res.status(500).json({
      success: false,
      message: 'Error ejecutando comparación por canal',
      error: error.message,
    });
  }
});

/**
 * GET /api/snowflake/mismatch-pedidos
 * Ejecuta la query de pedidos con diferencias (mismatch)
 */
router.get('/mismatch-pedidos', async (req, res) => {
  try {
    console.log('🔍 Ejecutando búsqueda de pedidos con diferencias...');
    const results = await executeSnowflakeQuery(QUERY_MISMATCH_PEDIDOS);
    
    res.json({
      success: true,
      count: results.length,
      data: results,
      query: 'MISMATCH_PEDIDOS',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error en mismatch pedidos:', error);
    res.status(500).json({
      success: false,
      message: 'Error ejecutando búsqueda de pedidos con diferencias',
      error: error.message,
    });
  }
});

router.get('/mismatch-analysis/:salesId', async (req, res) => {
  try {
    const salesId = (req.params.salesId || '').trim();
    if (!salesId) {
      return res.status(400).json({ success: false, message: 'salesId requerido' });
    }

    console.log(`🧮 Analizando diferencias para SalesId ${salesId}...`);
    const { report } = await analyzeSalesIdMismatch(salesId);

    res.json({
      success: true,
      ...report,
    });
  } catch (error) {
    console.error('Error en mismatch analysis:', error);
    res.status(500).json({
      success: false,
      message: 'Error analizando diferencias del pedido',
      error: error.message,
    });
  }
});

router.get('/correcciones/:salesId', async (req, res) => {
  try {
    const salesId = (req.params.salesId || '').trim();
    if (!salesId) {
      return res.status(400).json({ success: false, message: 'salesId requerido' });
    }

    console.log(`🛠️ Generando scripts de corrección para SalesId ${salesId}...`);
    const { report } = await analyzeSalesIdMismatch(salesId);

    const inserts = buildInsertStatements(salesId, report.lines);
    const updates = buildUpdateStatements(report.lines);

    res.json({
      success: true,
      salesId,
      summary: report.summary,
      generatedAt: new Date().toISOString(),
      inserts,
      updates,
    });
  } catch (error) {
    console.error('Error generando scripts de corrección:', error);
    res.status(500).json({
      success: false,
      message: 'Error generando scripts de corrección',
      error: error.message,
    });
  }
});

router.get('/query-logs', async (req, res) => {
  try {
    const filters = {
      salesId: req.query.salesId,
      actionType: req.query.actionType,
      kind: req.query.kind,
      limit: req.query.limit,
      offset: req.query.offset,
    };

    const [{ logs, limit, offset }, total] = await Promise.all([
      fetchQueryLogs(filters),
      countQueryLogs(filters),
    ]);

    res.json({
      success: true,
      logs,
      total,
      limit,
      offset,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error consultando logs de Snowflake:', error);
    res.status(500).json({
      success: false,
      message: 'No se pudieron recuperar los logs',
      error: error.message,
    });
  }
});

router.post('/query-logs/:logId/rollback', async (req, res) => {
  try {
    const logId = Number.parseInt(req.params.logId, 10);
    if (!Number.isFinite(logId) || logId <= 0) {
      return res.status(400).json({ success: false, message: 'logId inválido' });
    }

    const logEntry = await fetchLogById(logId);
    if (!logEntry) {
      return res.status(404).json({ success: false, message: 'Log no encontrado' });
    }

    const rollbackSql = (logEntry.rollbackSql || '').trim();
    if (!rollbackSql || rollbackSql === '-- N/A') {
      return res.status(400).json({ success: false, message: 'Este log no tiene rollback disponible' });
    }

    console.log(`♻️ Ejecutando rollback desde log ${logId}...`);
    const results = await executeSnowflakeQuery(rollbackSql);

    try {
      await logQueryExecution({
        actionType: 'rollback-from-log',
        executedSql: rollbackSql,
        rollbackSql: null,
        metadata: {
          sourceLogId: logEntry.logId,
          salesId: logEntry.salesId,
          entryId: logEntry.entryId,
          originalActionType: logEntry.actionType,
        },
        executedBy: req.body?.executedBy || null,
      });
    } catch (logError) {
      console.error('No se pudo registrar el rollback ejecutado desde log:', logError.message);
    }

    res.json({
      success: true,
      message: 'Rollback ejecutado desde el log',
      rows: results.length,
      sourceLogId: logEntry.logId,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error ejecutando rollback desde log:', error);
    res.status(500).json({
      success: false,
      message: 'No se pudo ejecutar el rollback solicitado',
      error: error.message,
    });
  }
});

/**
 * POST /api/snowflake/query-custom
 * Ejecuta una query personalizada (usar con precaución)
 */
router.post('/query-custom', async (req, res) => {
  try {
    const {
      query,
      rollbackSql = null,
      actionType = 'sql',
      metadata = {},
      executedBy = null,
    } = req.body;
    
    if (!query) {
      return res.status(400).json({
        success: false,
        message: 'Query SQL es requerida en el body',
      });
    }

    console.log('🔧 Ejecutando query personalizada...');
    const results = await executeSnowflakeQuery(query);
    try {
      await logQueryExecution({
        actionType,
        executedSql: query,
        rollbackSql,
        metadata,
        executedBy,
      });
    } catch (logError) {
      console.error('No se pudo registrar la ejecución en ZLOGS_QUERYS:', logError.message);
    }
    
    res.json({
      success: true,
      count: results.length,
      data: results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error en query personalizada:', error);
    res.status(500).json({
      success: false,
      message: 'Error ejecutando query personalizada',
      error: error.message,
    });
  }
});

export default router;

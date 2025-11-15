import { executeSnowflakeQuery } from './snowflakeService.js';
import { fetchODataBySalesId } from './odataService.js';
import { QUERY_DETALLE_LINEAS_POR_SALESID } from '../queries/snowflake-queries.js';

const NUMBER_TOLERANCE = 0.005;

const normalizeLineNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeAmount = (...candidates) => {
  for (const val of candidates) {
    if (val === null || val === undefined || val === '') continue;
    const num = Number(val);
    if (Number.isFinite(num)) return num;
  }
  return null;
};

const normalizeString = (...candidates) => {
  for (const val of candidates) {
    if (!val && val !== 0) continue;
    const str = String(val).trim();
    if (str) return str.toUpperCase();
  }
  return null;
};

export async function analyzeSalesIdMismatch(salesId = '') {
  const trimmedId = salesId.trim();
  if (!trimmedId) throw new Error('salesId requerido');

  const [snowflakeRows, odataResponse] = await Promise.all([
    executeSnowflakeQuery(QUERY_DETALLE_LINEAS_POR_SALESID, [trimmedId]),
    fetchODataBySalesId(trimmedId),
  ]);

  const odataLines = Array.isArray(odataResponse?.value) ? odataResponse.value : [];

  const odataMap = new Map();
  odataLines.forEach((line) => {
    const lineNo = normalizeLineNumber(
      line.LineCreationSequenceNumber ?? line.LINECREATIONSEQUENCENUMBER ?? line.LineNumber
    );
    if (lineNo === null) return;
    odataMap.set(lineNo, {
      amount: normalizeAmount(
        line.AccountingCurrencyAmount,
        line.ACCOUNTINGCURRENCYAMOUNT,
        line.LineAmount,
        line.LINEAMOUNT
      ),
      itemId: normalizeString(line.ItemNumber, line.ITEMNUMBER, line.ITEMID, line.ItemId),
      invoiceId: normalizeString(line.InvoiceId, line.INVOICEID),
      canal: normalizeString(line.GAPCanalDimension, line.GAPCANALDIMENSION),
      raw: line,
    });
  });

  const snowflakeMap = new Map();
  snowflakeRows.forEach((row) => {
    const lineNo = normalizeLineNumber(
      row.LINECREATIONSEQUENCENUMBER ?? row.LINE_NO ?? row.LINENUM
    );
    if (lineNo === null) return;
    snowflakeMap.set(lineNo, {
      amount: normalizeAmount(row.LINEAMOUNT, row.LINEAMOUNTMST),
      invoiceId: normalizeString(row.INVOICEID),
      canal: normalizeString(row.CANAL),
      linePk: row.SALESLINEPK,
      raw: row,
    });
  });

  const lineNumbers = Array.from(new Set([...odataMap.keys(), ...snowflakeMap.keys()]));
  lineNumbers.sort((a, b) => a - b);

  const summary = {
    odataLineCount: odataMap.size,
    snowflakeLineCount: snowflakeMap.size,
    missingInOData: [],
    missingInSnowflake: [],
    amountMismatches: [],
    itemMismatches: [],
    invoiceMismatches: [],
    dateMismatches: [],
    canalMismatches: [],
  };

  const lines = lineNumbers.map((lineNo) => {
    const odataLine = odataMap.get(lineNo) || null;
    const snowLine = snowflakeMap.get(lineNo) || null;
    const issues = [];
    const statusFlags = [];

    if (!odataLine) {
      statusFlags.push('MISSING_IN_ODATA');
      summary.missingInOData.push(lineNo);
      issues.push('Línea ausente en OData');
    } else if (!snowLine) {
      statusFlags.push('MISSING_IN_SNOWFLAKE');
      summary.missingInSnowflake.push(lineNo);
      issues.push('Línea ausente en Snowflake');
    } else {
      const snowAmount = snowLine.amount ?? null;
      const diff = (snowAmount ?? 0) - (odataLine.amount ?? 0);
      if (
        odataLine.amount !== null &&
        snowAmount !== null &&
        Math.abs(diff) > NUMBER_TOLERANCE
      ) {
        statusFlags.push('AMOUNT_MISMATCH');
        summary.amountMismatches.push(lineNo);
        issues.push(`Monto difiere por ${diff.toFixed(2)}`);
      }

      if (odataLine.invoiceId && snowLine.invoiceId && odataLine.invoiceId !== snowLine.invoiceId) {
        statusFlags.push('INVOICE_MISMATCH');
        summary.invoiceMismatches.push(lineNo);
        issues.push('InvoiceId distinto');
      }

      const odataCanal = normalizeString(odataLine.raw?.Canal, odataLine.raw?.GAPCanalDimension);
      if (odataCanal && snowLine.canal && odataCanal !== snowLine.canal) {
        statusFlags.push('CANAL_MISMATCH');
        summary.canalMismatches.push(lineNo);
        issues.push('Canal distinto');
      }
    }

    const status = statusFlags[0] || 'MATCH';
    const snowAmount = snowLine ? snowLine.amount ?? null : null;
    const odataAmount = odataLine?.amount ?? null;
    const diffValue = (snowAmount ?? 0) - (odataAmount ?? 0);

    return {
      lineNumber: lineNo,
      status,
      issues,
      odataAmount,
      snowflakeAmount: snowAmount,
      diffAmount: Number.isFinite(diffValue) ? diffValue : null,
      odata: odataLine,
      snowflake: snowLine,
    };
  });

  return {
    report: {
      salesId: trimmedId,
      summary,
      lines,
      sources: {
        odataRawCount: odataLines.length,
        snowflakeRawCount: snowflakeRows.length,
      },
      generatedAt: new Date().toISOString(),
    },
    context: {
      odataLines,
      snowflakeRows,
      odataMap,
      snowflakeMap,
    },
  };
}

export { normalizeAmount, normalizeLineNumber, normalizeString, NUMBER_TOLERANCE };

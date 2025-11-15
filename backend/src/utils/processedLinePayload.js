import { buildSalesLinePk, normalizeKey } from './salesLinePk.js';

export const PROCESSED_COLUMNS = [
  'SALESLINEPK',
  'DEFINITIONGROUP',
  'EXECUTIONID',
  'ISSELECTED',
  'TRANSFERSTATUS',
  'INVOICEDATE',
  'INVOICEID',
  'SALESID',
  'EXCHRATE',
  'SALESPRICE',
  'QTY',
  'ORIGINALPRICE',
  'ITEMID',
  'LINENUM',
  'CURRENCYCODE',
  'INVENTTRANSID',
  'INVENTDIMID',
  'INVENTLOCATIONID',
  'INVENTLOCATIONNAME',
  'REFCUSTINVOICETRANSRECID',
  'SALESPOOLID',
  'PURCHORDERFORMNUM',
  'DEV_SALESID',
  'DEV_INVOICEID',
  'LINEDISC',
  'LINEPERCENT',
  'MULTILNDISC',
  'MULTILNPERCENT',
  'SUMLINEDISC',
  'COSTAMOUNTADJUSTMENT',
  'COSTAMOUNTPOSTED',
  'COSTAMOUNTPHYSICAL',
  'DISCPERCENT',
  'LINEAMOUNT',
  'LINEAMOUNTTAX',
  'CONTRIBUTIONMARGIN',
  'CONTRIBUTIONRATIO',
  'BARCODE',
  'LINEAMOUNTMST',
  'LINEAMOUNTTAXMST',
  'SUMLINEDISCMST',
  'TAXAMOUNTMST',
  'DISCOUNTCODE',
  'STAFFID',
  'STAFFNAME',
  'TENDERTYPEID',
  'LINEAMOUNTWITHTAXES',
  'CONFIGID',
  'INVENTBATCHID',
  'INVENTCOLORID',
  'INVENTSERIALID',
  'INVENTSITEID',
  'INVENTSIZEID',
  'INVENTSTATUSID',
  'INVENTSTYLEID',
  'INVENTVERSIONID',
  'WMSLOCATIONID',
  'ITEMNAME',
  'SALESUNIT',
  'TAXITEMGROUP',
  'TAXGROUP',
  'TENDERTYPENAME',
  'CANAL',
  'CECO',
  'CANALCODE',
  'CECOCODE',
  'EXTERNALITEMID',
  'PRICEGROUPLIST',
  'CREATEDTRANSACTIONDATE2',
  'DEFAULTDIMENSIONDISPLAYVALUE',
  'PARTITION',
  'CUSTACCOUNT',
  'ORGANIZATIONNAME',
  'INVENTORYLOTID',
  'TRANSACTIONID',
  'RETURNTRANSACTIONID',
  'SKU',
  'LINECREATIONSEQUENCENUMBER',
  'SHIPPINGWAREHOUSEID',
  'PRIMARYCONTACTEMAIL',
  'INVOICECODE',
  'ITEMIDSCANNED',
  'KEYBOARDITEMENTRY',
  'PRICECHANGE',
  'DATAAREAID',
  'SYNCSTARTDATETIME',
  'SNOWFLAKE_CREATED_AT',
  'SNOWFLAKE_UPDATED_AT',
];

const COLUMN_INDEX = new Map(
  PROCESSED_COLUMNS.map((column) => [normalizeKey(column), column])
);

const ensureObject = (value) => (value && typeof value === 'object' ? value : {});

export function mapOdataRowToProcessedColumns(odataRaw = {}) {
  const mapped = {};
  Object.entries(ensureObject(odataRaw)).forEach(([key, value]) => {
    const normalized = normalizeKey(key);
    const column = COLUMN_INDEX.get(normalized);
    if (column) {
      mapped[column] = value;
    }
  });
  return mapped;
}

export function buildProcessedPayload({ salesId, odataRaw = {}, overrides = {} }) {
  const payload = mapOdataRowToProcessedColumns(odataRaw);

  if (salesId) {
    payload.SALESID = salesId;
    if (!payload.DEV_SALESID) payload.DEV_SALESID = salesId;
  }

  if (overrides && typeof overrides === 'object') {
    Object.entries(overrides).forEach(([key, value]) => {
      if (value === undefined) return;
      payload[key] = value;
    });
  }

  if (!payload.LINECREATIONSEQUENCENUMBER && odataRaw.LineCreationSequenceNumber) {
    payload.LINECREATIONSEQUENCENUMBER = odataRaw.LineCreationSequenceNumber;
  }

  if (!payload.LINENUM && odataRaw.LineNum) {
    payload.LINENUM = odataRaw.LineNum;
  }

  if (!payload.INVOICEDATE && odataRaw.InvoiceDate) {
    payload.INVOICEDATE = odataRaw.InvoiceDate;
  }

  payload.SALESLINEPK = buildSalesLinePk(payload);
  return payload;
}

export default buildProcessedPayload;

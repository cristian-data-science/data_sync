const ensureString = (value) => {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  return String(value);
};

export const normalizeKey = (key = '') => key.replace(/[^A-Za-z0-9]/g, '').toUpperCase();

const indexSource = (source = {}) => {
  const index = new Map();
  Object.entries(source).forEach(([key, value]) => {
    index.set(normalizeKey(key), value);
  });
  return index;
};

export const SALES_LINE_PK_SEQUENCE = [
  'QTY',
  'INVENTTRANSID',
  'INVENTDIMID',
  'REFCUSTINVOICETRANSRECID',
  'INVOICECODE',
  'INVOICEID',
  'SALESID',
  'DEV_INVOICEID',
  'DEV_SALESID',
  'ITEMID',
  'CONFIGID',
  'INVENTCOLORID',
  'INVENTSIZEID',
  'INVENTSTYLEID',
  'INVENTSTATUSID',
  'INVENTLOCATIONID',
  'LINECREATIONSEQUENCENUMBER',
];

export function buildSalesLinePk(source = {}) {
  const index = indexSource(source);
  const parts = SALES_LINE_PK_SEQUENCE.map((column) => {
    const value = index.get(normalizeKey(column));
    return ensureString(value ?? '');
  });
  return parts.join('-');
}

export default buildSalesLinePk;

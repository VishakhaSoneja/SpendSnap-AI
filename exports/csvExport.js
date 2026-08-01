/**
 * Minimal RFC-4180 CSV serializer — no external dependencies.
 * Fields containing commas, quotes or newlines are quoted and escaped.
 */

const escapeCell = (value) => {
  if (value === null || value === undefined) return '';
  const text = String(value);
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
};

/**
 * @param {Array<Object>} rows
 * @param {Array<{label: string, value: string}>} fields
 * @returns {string} CSV string with UTF-8 BOM (for Excel) and CRLF endings.
 */
const buildCsv = (rows, fields) => {
  const header = fields.map((f) => escapeCell(f.label)).join(',');
  const lines = rows.map((row) => fields.map((f) => escapeCell(row[f.value])).join(','));
  return `\uFEFF${[header, ...lines].join('\r\n')}\r\n`;
};

module.exports = { buildCsv };

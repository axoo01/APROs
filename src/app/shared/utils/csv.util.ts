/** RFC 4180 CSV. Fields with quotes, commas or line breaks are quoted; formula-leading cells are neutralised. */
export function toCsv(rows: readonly (readonly (string | number | null | undefined)[])[]): string {
  return rows.map((row) => row.map(csvField).join(',')).join('\r\n');
}

function csvField(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  let s = String(value);
  // Guard against CSV/formula injection when opened in a spreadsheet.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

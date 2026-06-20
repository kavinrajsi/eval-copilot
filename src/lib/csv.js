// Minimal RFC-4180-ish CSV, used by golden-case import (client) and export
// (server). Handles quoted fields containing commas, quotes ("" escape), and
// newlines. Not a full CSV engine — enough for a two-column input/known_good set.

export function parseCsv(text) {
  const s = String(text ?? "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  let i = 0;

  while (i < s.length) {
    const ch = s[i];
    if (inQuotes) {
      if (ch === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === ",") {
      row.push(field);
      field = "";
      i++;
      continue;
    }
    if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i++;
      continue;
    }
    field += ch;
    i++;
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  // Drop fully-blank lines.
  return rows.filter((r) => !(r.length === 1 && r[0].trim() === ""));
}

/**
 * Parse CSV and map required header columns to their indexes. Returns
 * { rows } where each row is the data rows (header stripped); throws if the
 * file is empty or a required column is missing. Callers map cells via `cols`.
 *
 * @param {string} text
 * @param {string[]} cols  required lowercase header names, e.g. ["input","known_good"]
 * @returns {{ header: string[], idx: Record<string,number>, rows: string[][] }}
 */
export function parseCsvWithHeaders(text, cols) {
  const parsed = parseCsv(text);
  if (!parsed.length) throw new Error("empty file");
  const header = parsed[0].map((h) => h.trim().toLowerCase());
  const idx = {};
  for (const c of cols) {
    const i = header.indexOf(c);
    if (i < 0) throw new Error(`CSV needs ${cols.map((x) => `'${x}'`).join(" and ")} headers`);
    idx[c] = i;
  }
  return { header, idx, rows: parsed.slice(1) };
}

export function toCsv(rows) {
  const esc = (v) => {
    const str = String(v ?? "");
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };
  return rows.map((r) => r.map(esc).join(",")).join("\n");
}

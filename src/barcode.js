// The same printed barcode can come back from the scanner in more than one
// form. A 12-digit UPC-A (common on North American products) is also a valid
// 13-digit EAN-13 with a leading 0, and the decoder may report either one
// depending on which reader recognises it first. Treat them as the same code.

/** Digits only, no spaces or dashes (QR/Code 128 values are kept as-is). */
export function cleanBarcode(raw = '') {
  const trimmed = String(raw).trim()
  return /^[\d\s-]+$/.test(trimmed) ? trimmed.replace(/[\s-]/g, '') : trimmed
}

/** Canonical form we store: UPC-A is saved as its 13-digit EAN equivalent. */
export function normalizeBarcode(raw) {
  const code = cleanBarcode(raw)
  return /^\d{12}$/.test(code) ? `0${code}` : code
}

/** True when two codes are the same number apart from leading zeros (UPC-A vs EAN-13 vs GTIN-14). */
export function sameBarcode(a, b) {
  if (!a || !b) return false
  const x = cleanBarcode(a)
  const y = cleanBarcode(b)
  if (x === y) return true
  return /^\d+$/.test(x) && /^\d+$/.test(y) && x.replace(/^0+/, '') === y.replace(/^0+/, '')
}

/** Every spelling of this code that might already be saved. */
export function barcodeVariants(raw) {
  const code = cleanBarcode(raw)
  const out = new Set([code, normalizeBarcode(code)])
  if (/^0\d{12}$/.test(code)) out.add(code.slice(1)) // EAN-13 with leading 0 → UPC-A
  return [...out].filter(Boolean)
}

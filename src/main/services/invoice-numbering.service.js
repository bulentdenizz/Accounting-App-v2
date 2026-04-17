/**
 * invoice-numbering.service.js
 *
 * Yıllık sıfırlanan, tip bazlı fatura numarası üretir.
 *
 * Format: {PREFIX}-{YIL}-{SIRALAMALI_4_HANE}
 * Örnekler:
 *   SAT-2026-0001  → 1. satış faturası
 *   ALI-2026-0042  → 42. alış faturası
 *
 * ÖNEMLI: Bu fonksiyon bir SQLite transaction bloğu içinde çağrılmalıdır.
 * Atomicity transaction'ın dışarıdaki koduna aittir.
 */

/**
 * @param {import('better-sqlite3').Database} db
 * @param {'sale' | 'purchase'} type
 * @returns {string}  Üretilen fatura numarası
 */
export function generateInvoiceNumber(db, type) {
  const allowed = ['sale', 'purchase'];
  if (!allowed.includes(type)) {
    // Ödeme, iade gibi türler için fatura numarası üretilmez
    return null;
  }

  const currentYear = new Date().getFullYear();

  const seq = db.prepare('SELECT * FROM invoice_sequences WHERE type = ?').get(type);
  if (!seq) {
    throw new Error(`invoice_sequences tablosunda '${type}' tipi bulunamadı.`);
  }

  // Yıl değiştiyse sırayı sıfırla
  if (seq.year !== currentYear) {
    db.prepare(
      'UPDATE invoice_sequences SET last_number = 1, year = ? WHERE type = ?'
    ).run(currentYear, type);
    return `${seq.prefix}-${currentYear}-0001`;
  }

  const nextNumber = seq.last_number + 1;
  db.prepare(
    'UPDATE invoice_sequences SET last_number = ? WHERE type = ?'
  ).run(nextNumber, type);

  // Minimum 4 hane, gerektiğinde genişler (0001 → ... → 9999 → 10000)
  const paddedNumber = String(nextNumber).padStart(4, '0');
  return `${seq.prefix}-${currentYear}-${paddedNumber}`;
}

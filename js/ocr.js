/**
 * Bill OCR Scanner & Text Parsing Module
 * Provides in-browser image pre-processing, Tesseract.js optical recognition,
 * and intelligent heuristic regex line-item parsing specifically tuned for
 * restaurant bills, cafe receipts, and Indian/international dining invoices.
 */

// Noise phrases that can be matched as phrases
const NOISE_PHRASES = [
  'subtotal', 'sub-total', 'sub total', 's.total',
  'balance due', 'amount due', 'net amount', 'round off', 'grand total',
  'service charge', 'visit again', 'thank you', 'thanks for', 'have a nice day',
  'bill no', 'token no', 'invoice no', 'kot no', 'order no', 'table no', 'ref no'
];

// Single noise words that must be matched on word boundaries (\bword\b)
const NOISE_WORDS = [
  'tax', 'vat', 'gst', 'gstin', 'cgst', 'sgst', 'igst', 'cess', 'fssai', 'cin', 'pan', 'sac', 'hsn',
  'total', 'tip', 'gratuity', 'visa', 'mastercard', 'amex', 'discover', 'debit', 'credit', 'card',
  'cash', 'change', 'tend', 'tendered', 'upi', 'phonepe', 'gpay', 'paytm',
  'date', 'time', 'table', 'server', 'waiter', 'steward', 'captain', 'pax',
  'check', 'order', 'guest', 'guests', 'counter', 'pos', 'kds',
  'bill', 'token', 'invoice', 'kot', 'merchant', 'terminal', 'auth', 'approval', 'trans', 'txn',
  'phone', 'tel', 'mob', 'contact', 'call',
  'bengaluru', 'bangalore', 'mumbai', 'delhi', 'karnataka', 'maharashtra', 'chennai', 'hyderabad',
  'road', 'street', 'cross', 'layout', 'nagar', 'floor', 'city', 'pincode', 'pin'
];

/**
 * Checks if a string or number is an Indian 6-digit PIN code (e.g. 560001)
 */
function isPinCode(str) {
  return /^[1-9][0-9]{5}$/.test(str.trim());
}

/**
 * Checks if a price is outside realistic restaurant item prices (e.g. phone numbers or postal codes)
 */
function isUnrealisticPrice(price) {
  return price > 15000 || price < 1;
}

/**
 * Cleans extracted dish names by stripping leading serial numbers,
 * embedded item codes, internal quantities, and trailing tax symbols.
 * 
 * Example: "1. Masala Dosa 1 149.00 %" -> "Masala Dosa"
 */
function cleanDishName(rawName) {
  let name = rawName;

  // 1. Strip leading item numbers like "1. ", "02) ", "#3 "
  name = name.replace(/^(\d{1,2}[\.\)\-\s]+|#\d+\s*)/, '');

  // 2. Strip trailing percentage, tax, or punctuation marks like "%", "*", ":", "-", "."
  name = name.replace(/[\s\.\-:_~*%\$€£₹¥]+$/, '');

  // 3. Strip trailing rate/quantity patterns if OCR captured "Masala Dosa 1 149.00"
  name = name.replace(/\s+\d+\s+\d+[.,]\d{2}.*$/, '');

  // 4. Strip single isolated trailing quantity digits like "Tea 2" -> "Tea"
  name = name.replace(/\s+\d+$/, '');

  // 5. Final whitespace cleanup
  return name.trim();
}

/**
 * Heuristically parses raw text into an array of items and prices.
 * Handles messy OCR lines, varying spacing, and currency symbols.
 * 
 * @param {string} rawText
 * @returns {Array<{ name: string, price: number, isFood: boolean }>}
 */
export function parseReceiptText(rawText) {
  if (!rawText || typeof rawText !== 'string') return [];

  const lines = rawText.split(/\r?\n/);
  const items = [];

  // Price matchers
  const priceRegex = /([$€£₹¥]?\s*\d+[.,]\d{2})\s*[%*]?\s*$/;
  const intPriceRegex = /([$€£₹¥]?\s*\d{2,5})\s*[%*]?\s*$/;

  for (let rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.length < 3) continue;

    const lower = trimmed.toLowerCase();

    // 1. Check noise phrases
    const isPhraseNoise = NOISE_PHRASES.some(phrase => lower.includes(phrase));
    if (isPhraseNoise) continue;

    // 2. Check noise words on word boundaries
    const isWordNoise = NOISE_WORDS.some(word => {
      const rx = new RegExp(`\\b${word}\\b`, 'i');
      return rx.test(lower);
    });
    if (isWordNoise) continue;

    // 2. Skip obvious phone numbers, dates, GSTINs
    if (/(\d{3,4}[-\s]\d{3,4}|\b\d{10}\b)/.test(trimmed)) continue;
    if (/\b\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}\b/.test(trimmed)) continue; // GSTIN format
    if (/\b\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}\b/.test(trimmed)) continue; // Date

    // 3. Match trailing price
    let match = trimmed.match(priceRegex);
    if (!match) {
      match = trimmed.match(intPriceRegex);
    }

    if (match) {
      const priceStr = match[1].replace(/[$€£₹¥\s]/g, '').replace(',', '.');
      const price = parseFloat(priceStr);

      // Validate price (not NaN, not a 6-digit pin code, within realistic restaurant item range)
      if (!isNaN(price) && price > 0 && !isPinCode(priceStr) && !isUnrealisticPrice(price)) {
        // Strip matched price from line
        let rawItemName = trimmed.substring(0, match.index).trim();
        let cleanedName = cleanDishName(rawItemName);

        // Check that item name isn't just numbers, symbols, or phone prefixes
        if (cleanedName.length >= 2 && !/^\d+$/.test(cleanedName) && !/^(ph|tel|mob|gst)/i.test(cleanedName)) {
          items.push({
            name: cleanedName,
            price: Math.round(price * 100) / 100,
            isFood: true
          });
        }
      }
    }
  }

  return items;
}

/**
 * Pre-processes an image on an off-screen canvas to maximize OCR contrast.
 * Converts to high-contrast grayscale and normalizes resolution.
 * 
 * @param {HTMLImageElement} img
 * @returns {HTMLCanvasElement}
 */
export function preprocessReceiptImage(img) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  const maxDim = 1800;
  let { width, height } = img;
  if (width > maxDim || height > maxDim) {
    if (width > height) {
      height = Math.round((height * maxDim) / width);
      width = maxDim;
    } else {
      width = Math.round((width * maxDim) / height);
      height = maxDim;
    }
  }

  canvas.width = width;
  canvas.height = height;
  ctx.drawImage(img, 0, 0, width, height);

  // Grayscale & Contrast Enhancement
  const imgData = ctx.getImageData(0, 0, width, height);
  const d = imgData.data;

  for (let i = 0; i < d.length; i += 4) {
    const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    const enhanced = gray > 140 ? Math.min(255, gray * 1.15) : Math.max(0, gray * 0.85);
    d[i] = enhanced;
    d[i + 1] = enhanced;
    d[i + 2] = enhanced;
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

/**
 * In-browser optical recognition using Tesseract.js
 * 
 * @param {File|Blob} imageFile
 * @param {Function} onProgress - receives { status: string, progress: number }
 * @returns {Promise<string>} - returns recognized raw text
 */
export async function processReceiptImage(imageFile, onProgress = () => {}) {
  if (typeof window === 'undefined' || !window.Tesseract) {
    throw new Error('Tesseract OCR engine is not loaded. Please ensure you are online or check your browser connection.');
  }

  const imgUrl = URL.createObjectURL(imageFile);
  const img = new Image();

  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = () => reject(new Error('Failed to load image file.'));
    img.src = imgUrl;
  });

  const canvas = preprocessReceiptImage(img);
  URL.revokeObjectURL(imgUrl);

  const result = await window.Tesseract.recognize(canvas, 'eng', {
    logger: m => {
      if (m && m.progress !== undefined) {
        onProgress({
          status: m.status || 'Processing receipt image...',
          progress: Math.round(m.progress * 100)
        });
      }
    }
  });

  return result.data?.text || '';
}

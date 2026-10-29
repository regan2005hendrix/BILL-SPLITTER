/**
 * Bill OCR Scanner & Text Parsing Module
 * Provides in-browser image pre-processing, Tesseract.js optical recognition,
 * and heuristic regex line-item parsing.
 */

// Common receipt noise keywords to filter out non-dish lines
const NOISE_KEYWORDS = [
  'subtotal', 'sub-total', 'sub total',
  'tax', 'vat', 'gst', 'hst',
  'total', 'grand total', 'balance due', 'amount due',
  'tip', 'gratuity', 'suggested',
  'visa', 'mastercard', 'amex', 'discover', 'debit', 'credit',
  'cash', 'change', 'tend', 'tendered',
  'date', 'time', 'table', 'server', 'check', 'order', 'guest', 'guests',
  'merchant', 'terminal', 'auth', 'approval', 'trans',
  'thank you', 'thanks for', 'welcome', 'phone', 'tel', 'www', 'http'
];

/**
 * Heuristically parses raw text into an array of items and prices.
 * Handles messy OCR lines, varying spacing, and currency symbols.
 * 
 * @param {string} rawText
 * @returns {Array<{ name: string, price: number }>}
 */
export function parseReceiptText(rawText) {
  if (!rawText || typeof rawText !== 'string') return [];

  const lines = rawText.split(/\r?\n/);
  const items = [];

  // Match line ending with a number that looks like a price:
  // e.g. "Margherita Pizza $14.50", "Peroni Beer 12.00", "Steak - 28.50"
  // Currency symbols optional: $, €, £, ₹, ¥
  const priceRegex = /([$€£₹¥]?\s*\d+[.,]\d{2})\s*$/;
  const genericPriceRegex = /([$€£₹¥]?\s*\d+(?:[.,]\d{2})?)\s*$/;

  for (let rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.length < 3) continue;

    const lower = trimmed.toLowerCase();

    // 1. Skip lines that contain noise words
    const isNoise = NOISE_KEYWORDS.some(kw => {
      // Check if word boundary matches noise word
      const regex = new RegExp(`\\b${kw}\\b`, 'i');
      return regex.test(lower);
    });

    if (isNoise) continue;

    // 2. Test for trailing price pattern
    let match = trimmed.match(priceRegex);
    if (!match) {
      match = trimmed.match(genericPriceRegex);
    }

    if (match) {
      const priceStr = match[1].replace(/[$€£₹¥\s]/g, '').replace(',', '.');
      const price = parseFloat(priceStr);

      if (!isNaN(price) && price > 0) {
        // Strip the matched price from the line to get the item name
        let itemName = trimmed.substring(0, match.index).trim();
        // Clean trailing dots, dashes, or colons (e.g. "Pizza .... 14.50" -> "Pizza")
        itemName = itemName.replace(/[\s\.\-:_~*]+$/, '').trim();

        // Discard if name is empty or too short
        if (itemName.length >= 2) {
          items.push({
            name: itemName,
            price: Math.round(price * 100) / 100
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

  // Scale down if massive (e.g. 48MP phone photo) to maintain browser responsiveness
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
    // Luminance formula
    const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    // Contrast boost: values above 140 become lighter, below 140 become darker
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

  // Load image into HTMLImageElement
  const imgUrl = URL.createObjectURL(imageFile);
  const img = new Image();

  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = () => reject(new Error('Failed to load image file.'));
    img.src = imgUrl;
  });

  // Pre-process canvas for higher OCR clarity
  const canvas = preprocessReceiptImage(img);
  URL.revokeObjectURL(imgUrl);

  // Execute OCR with Tesseract
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

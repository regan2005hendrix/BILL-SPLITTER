/**
 * Dynamic Payment QR Code & URI Generator
 * Generates instant payment QR codes for UPI (India), Venmo, PayPal, and generic payment links.
 */

/**
 * Normalizes payment handles and generates appropriate payment URI
 * 
 * @param {Object} options
 * @param {string} options.handle - UPI ID (e.g. name@upi), Venmo (@username), PayPal handle, or phone
 * @param {number} options.amount - Exact payment amount
 * @param {string} options.currency - Currency symbol ($, €, £, ₹, etc.)
 * @param {string} options.name - Payee name
 * @param {string} options.note - Transaction note
 * @returns {{ uri: string, type: 'upi'|'venmo'|'paypal'|'generic', label: string }}
 */
export function generatePaymentURI({
  handle = '',
  amount = 0,
  currency = '$',
  name = 'Friend',
  note = 'Tabby Bill Split'
}) {
  const cleanHandle = (handle || '').trim();
  const safeAmount = Math.max(0.01, parseFloat(amount) || 0).toFixed(2);
  const safeNote = note || 'Tabby Bill Split';

  // 1. Venmo Handle (starts with @)
  if (cleanHandle.startsWith('@')) {
    const venmoUser = cleanHandle.replace(/^@/, '');
    const uri = `https://venmo.com/?txn=pay&recipients=${encodeURIComponent(venmoUser)}&amount=${safeAmount}&note=${encodeURIComponent(safeNote)}`;
    return {
      uri,
      type: 'venmo',
      label: `Venmo (@${venmoUser})`
    };
  }

  // 2. UPI Handle (contains '@' with name and bank handle, e.g. user@bank)
  if (cleanHandle.includes('@') && !cleanHandle.startsWith('http')) {
    const cu = currency === '₹' ? 'INR' : 'INR';
    const uri = `upi://pay?pa=${encodeURIComponent(cleanHandle)}&pn=${encodeURIComponent(name)}&am=${safeAmount}&cu=${cu}&tn=${encodeURIComponent(safeNote)}`;
    return {
      uri,
      type: 'upi',
      label: `UPI Payment: ${cleanHandle}`
    };
  }

  // 3. Plain username without @ (default to Venmo if alphanumeric 3-30 chars)
  if (/^[a-zA-Z0-9_-]{3,30}$/.test(cleanHandle)) {
    const uri = `https://venmo.com/?txn=pay&recipients=${encodeURIComponent(cleanHandle)}&amount=${safeAmount}&note=${encodeURIComponent(safeNote)}`;
    return {
      uri,
      type: 'venmo',
      label: `Venmo (@${cleanHandle})`
    };
  }

  // 3. Fallback: Direct URL or simple payment reference
  if (cleanHandle.startsWith('http://') || cleanHandle.startsWith('https://')) {
    return {
      uri: cleanHandle,
      type: 'generic',
      label: cleanHandle
    };
  }

  // 4. Default generic URI
  return {
    uri: `payment:${encodeURIComponent(cleanHandle)}?amount=${safeAmount}&name=${encodeURIComponent(name)}`,
    type: 'generic',
    label: cleanHandle || name
  };
}

/**
 * Renders a high-contrast QR code inside a target DOM element.
 * Uses window.QRCode if available, or renders an accessible fallback message.
 * 
 * @param {HTMLElement} container
 * @param {Object} paymentOptions
 */
export function renderPaymentQRCode(container, paymentOptions) {
  if (!container) return null;
  container.innerHTML = '';

  const payment = generatePaymentURI(paymentOptions);

  if (typeof window !== 'undefined' && window.QRCode) {
    try {
      new window.QRCode(container, {
        text: payment.uri,
        width: 200,
        height: 200,
        colorDark: '#0f172a',
        colorLight: '#ffffff',
        correctLevel: window.QRCode.CorrectLevel.M
      });
      return payment;
    } catch (e) {
      console.warn('QRCode rendering failed, rendering fallback:', e);
    }
  }

  // Fallback if QRCode library is blocked by ad-blocker or offline
  const fallbackDiv = document.createElement('div');
  fallbackDiv.style.padding = '16px';
  fallbackDiv.style.textAlign = 'center';
  fallbackDiv.style.color = 'var(--color-ink)';
  fallbackDiv.innerHTML = `
    <div style="font-size: 36px; margin-bottom: 8px;">📲</div>
    <div style="font-weight: 600; margin-bottom: 4px;">${payment.label}</div>
    <div class="mono" style="font-size: 14px; word-break: break-all; color: var(--color-muted);">${payment.uri}</div>
  `;
  container.appendChild(fallbackDiv);
  return payment;
}

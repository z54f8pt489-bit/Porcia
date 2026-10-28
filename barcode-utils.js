/* Product identifiers only. Serial numbers and arbitrary QR links never leave the device. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TeloBarcode = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const LENGTHS = [8, 12, 13, 14];
  function check(code) {
    if (typeof code !== 'string' || !LENGTHS.includes(code.length) || !/^\d+$/.test(code) || /^0+$/.test(code)) return false;
    let sum = 0;
    for (let i = code.length - 2, weight = 3; i >= 0; i--, weight = 4 - weight) sum += Number(code[i]) * weight;
    return (10 - sum % 10) % 10 === Number(code.at(-1));
  }
  function canonical(code) {
    if (!check(code)) return null;
    const gtin = code.padStart(14, '0');
    // Remove zero padding only. A nonzero GTIN-14 packaging indicator identifies a different item.
    for (const length of LENGTHS) {
      const shorter = gtin.slice(-length);
      if (/^0*$/.test(gtin.slice(0, 14 - length)) && check(shorter)) return shorter;
    }
    return null;
  }
  function expandUPCE(code) {
    if (!/^[01]\d{7}$/.test(code)) return null;
    const n = code[0], d = code.slice(1, 7), c = code[7];
    let expanded;
    if (/[012]/.test(d[5])) expanded = n + d.slice(0, 2) + d[5] + '0000' + d.slice(2, 5) + c;
    else if (d[5] === '3') expanded = n + d.slice(0, 3) + '00000' + d.slice(3, 5) + c;
    else if (d[5] === '4') expanded = n + d.slice(0, 4) + '00000' + d[4] + c;
    else expanded = n + d.slice(0, 5) + '0000' + d[5] + c;
    return check(expanded) ? expanded : null;
  }
  function parse(raw, format) {
    if (typeof raw !== 'string' || !raw || raw.length > 4096) return null;
    let text = raw.trim().replace(/^\uFEFF/, '').replace(/^\](?:d2|C1|Q3)/i, '').replace(/^[\u001d\u00e8]/, '');
    let code = null, kind = 'linear';
    const compact = text.replace(/[\s\u00a0]/g, '');
    if (String(format || '').toLowerCase().replace(/[-_]/g, '') === 'upce') code = expandUPCE(compact);
    else if (check(compact)) code = compact;
    else {
      const gs1 = /^(?:\(01\)\s*|01)(\d{14})/.exec(text);
      if (gs1 && check(gs1[1])) { code = gs1[1]; kind = 'gs1'; }
      if (!code && /^https?:\/\//i.test(text)) {
        try {
          const url = new URL(text);
          const path = /(?:^|\/)01\/(\d{14})(?:\/|$)/.exec(url.pathname);
          const explicit = path?.[1] || url.searchParams.get('gtin') || url.searchParams.get('01');
          if (explicit && check(explicit)) { code = explicit; kind = 'digital-link'; }
          // A marking link may carry its GS1 payload as a URL-encoded parameter.
          if (!code && /(^|\.)(?:crpt\.ru|markirovka\.ru|xn--80ajghhoc2aj1c8b\.xn--p1ai)$/i.test(url.hostname)) {
            const cis = url.searchParams.get('cis') || url.searchParams.get('code');
            const match = /^(?:\(01\)|01)(\d{14})/.exec(cis || '');
            if (match && check(match[1])) { code = match[1]; kind = 'gs1'; }
          }
        } catch { /* A QR containing an unrelated URL is not a product identifier. */ }
      }
    }
    if (!code || !check(code)) return null;
    return {code: canonical(code), gtin14: code.padStart(14, '0'), kind};
  }
  function sameProduct(left, right) {
    const a = parse(String(left || '')), b = parse(String(right || ''));
    return !!a && !!b && a.gtin14 === b.gtin14;
  }
  function lookupCodes(raw) {
    const parsed = parse(String(raw || ''));
    if (!parsed) return [];
    return [...new Set([parsed.code, parsed.gtin14])];
  }
  function isDecodeMiss(error, decoder) {
    // The bundled decoder minifies exception names (e.g. NotFoundException becomes "N").
    // Normal empty camera frames must not disable QR / Data Matrix decoding after four misses.
    return ['NotFoundException', 'ChecksumException', 'FormatException', 'ReaderException'].some(name =>
      typeof decoder?.[name] === 'function' && error instanceof decoder[name]
    ) || /NotFound|Checksum|Format|ReaderException/.test(String(error?.name || error?.constructor?.name || ''));
  }
  const nativeFormats = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'itf', 'code_128', 'data_matrix', 'qr_code'];
  const zxingFormats = ['EAN_13', 'EAN_8', 'UPC_A', 'UPC_E', 'ITF', 'CODE_128', 'DATA_MATRIX', 'QR_CODE'];
  return Object.freeze({check, canonical, expandUPCE, parse, sameProduct, lookupCodes, isDecodeMiss, nativeFormats, zxingFormats});
});

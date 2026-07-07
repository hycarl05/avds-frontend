const scoreDecodedText = (text) => {
  const s = String(text ?? '');
  if (!s) return Number.NEGATIVE_INFINITY;

  const letters = (s.match(/[A-Za-z]/g) || []).length;
  const digits = (s.match(/[0-9]/g) || []).length;
  const tags = (s.match(/\[(?:pt|pb|jp|jl|sc|cf|fo|nl|np|p|\/p|l|tcs|fs|aw|cb|sh|fl|t)\b[^\]]*\]/gi) || []).length;
  const qstHead = /<QST\d+>/i.test(s) ? 1 : 0;
  const replacement = (s.match(/\uFFFD/g) || []).length;
  const cjk = (s.match(/[\u4E00-\u9FFF]/g) || []).length;

  return (letters * 4) + (digits * 2) + (tags * 15) + (qstHead * 120) - (replacement * 25) - (cjk * 8);
};

const safeDecode = (bytes, encoding) => {
  try {
    return new TextDecoder(encoding, { fatal: false }).decode(bytes);
  } catch {
    return '';
  }
};

const decodeNullStripped = (bytes) => {
  const filtered = [];
  for (let i = 0; i < bytes.length; i += 1) {
    if (bytes[i] !== 0) filtered.push(bytes[i]);
  }
  return safeDecode(new Uint8Array(filtered), 'utf-8');
};

const decodeMixedUtf16LeRuns = (bytes) => {
  const out = [];
  let i = 0;
  while (i < bytes.length) {
    if (
      i + 1 < bytes.length
      && bytes[i + 1] === 0
      && bytes[i] >= 0x09
      && bytes[i] <= 0x7e
    ) {
      out.push(bytes[i]);
      i += 2;
      continue;
    }
    out.push(bytes[i]);
    i += 1;
  }
  return safeDecode(new Uint8Array(out), 'utf-8');
};

export const decodeQstBestEffort = (arrayBuffer) => {
  const bytes = new Uint8Array(arrayBuffer || new ArrayBuffer(0));
  const candidates = [
    safeDecode(bytes, 'utf-8'),
    safeDecode(bytes, 'utf-16le'),
    safeDecode(bytes, 'utf-16be'),
    safeDecode(bytes, 'windows-1252'),
    decodeNullStripped(bytes),
    decodeMixedUtf16LeRuns(bytes),
  ];

  let best = '';
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const c of candidates) {
    const score = scoreDecodedText(c);
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }

  let cleaned = String(best ?? '')
    .replace(/\u0000/g, '')
    .replace(/\uFFFD/g, '')
    .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .trim();

  const rsIdx = cleaned.search(/\[RS\]/i);
  if (rsIdx >= 0) {
    cleaned = cleaned.slice(0, rsIdx);
  }

  cleaned = cleaned.replace(/[\u00FF]{8,}/g, ' ');
  return cleaned.trim();
};

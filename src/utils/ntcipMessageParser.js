const DEFAULT_COLOR = 'yellow';

const INDEXED_CF_COLOR = {
  1: 'yellow',
  2: 'red',
  3: 'green',
  4: 'yellow',
};

const stripControlTags = (s) =>
  String(s ?? '')
    .replace(/^[^\[]+(?=\[)/, '')
    .replace(/[$@&]d/gi, ' ')
    .replace(/\[tcs[^\]]*\]/gi, '')
    .replace(/\[(?:pt|pb|jp|jl|sc|fo)[^\]]*\]/gi, '')
    .replace(/\[\/?.*?\]/g, '')
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/[\[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const isReadablePayload = (text) => {
  const s = String(text ?? '');
  const letters = (s.match(/[A-Za-z]/g) || []).length;
  const digits = (s.match(/[0-9]/g) || []).length;
  const cjk = (s.match(/[\u4E00-\u9FFF]/g) || []).length;
  return (letters + digits) >= 12 && cjk <= Math.max(20, letters * 2);
};

const rgbToLedColor = (r, g, b) => {
  if (r >= 180 && g <= 110 && b <= 110) return 'red';
  if (g >= 160 && r <= 140 && b <= 140) return 'green';
  return 'yellow';
};

const parseCfTag = (tagBody) => {
  const idx = String(tagBody).match(/^cf\s*([0-9]{1,2})$/i);
  if (idx) {
    return INDEXED_CF_COLOR[Number(idx[1])] ?? DEFAULT_COLOR;
  }

  const m = String(tagBody).match(/^cf\s*([0-9]{1,3})\s*,\s*([0-9]{1,3})\s*,\s*([0-9]{1,3})$/i);
  if (!m) return null;
  return rgbToLedColor(Number(m[1]), Number(m[2]), Number(m[3]));
};

const parseSinglePage = (pageRaw) => {
  const page = String(pageRaw ?? '');
  if (!page.trim()) return { lines: [], colors: [] };

  const lines = [];
  const colors = [];
  let currentLine = '';
  let currentColor = DEFAULT_COLOR;

  const re = /\[([^\]]+)\]/g;
  let cursor = 0;
  let match;

  const pushLine = () => {
    const cleaned = stripControlTags(currentLine);
    if (cleaned) {
      lines.push(cleaned);
      colors.push(currentColor);
    }
    currentLine = '';
  };

  while ((match = re.exec(page)) !== null) {
    const text = page.slice(cursor, match.index);
    if (text) currentLine += text;

    const tagBody = String(match[1] ?? '').trim();
    const lowered = tagBody.toLowerCase();

    const cfColor = parseCfTag(tagBody);
    if (cfColor) {
      currentColor = cfColor;
    } else if (lowered === 'np') {
      pushLine();
    } else if (lowered.startsWith('nl') || lowered.startsWith('l')) {
      pushLine();
    }

    cursor = re.lastIndex;
  }

  const tail = page.slice(cursor);
  if (tail) currentLine += tail;

  // Support literal newline-delimited lines used by many JETFILE qst payloads.
  const tailLines = currentLine.split('\n');
  if (tailLines.length > 1) {
    for (const line of tailLines) {
      const cleaned = stripControlTags(line);
      if (cleaned) {
        lines.push(cleaned);
        colors.push(currentColor);
      }
    }
    currentLine = '';
  }

  pushLine();

  return { lines, colors };
};

export const parseNtcipMessage = (raw) => {
  const normalized = String(raw ?? '')
    .replace(/\u0000/g, '')
    .replace(/\uFFFD/g, '')
    .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/[\uFFFD\uFFF0-\uFFFF]/g, '')
    .replace(/^[^\[]+(?=\[)/, '')
    .replace(/[$@&]d/gi, ' ')
    .replace(/<QST\d+>\s*[0-9A-F]+&?/gi, '')
    .replace(/\[tcs[^\]]*\]/gi, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[\u00FF]{8,}/g, ' ')
    .trim();

  if (!normalized) return { pages: [], pageColors: [] };

  const rsIdx = normalized.search(/\[RS\]/i);
  const bounded = rsIdx >= 0 ? normalized.slice(0, rsIdx) : normalized;

  const readabilityCheck = bounded
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!isReadablePayload(readabilityCheck)) {
    return { pages: [], pageColors: [] };
  }

  const rawPages = bounded
    .split(/\[np\]|\[\/p\]\s*\[p\]/i)
    .map((p) => p.trim())
    .filter(Boolean);

  const pages = [];
  const pageColors = [];

  for (const p of rawPages) {
    const parsed = parseSinglePage(p);
    if (parsed.lines.length > 0) {
      pages.push(parsed.lines);
      pageColors.push(parsed.colors);
    }
  }

  return { pages, pageColors };
};

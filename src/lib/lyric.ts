function cleanLine(text: string): string {
  return text
    .replace(/[「」『』"'“”]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalize(text: string): string {
  return text.replace(/報/g, '报').replace(/預/g, '预').replace(/測/g, '测').replace(/顏/g, '颜');
}

function titleOverlap(line: string, title: string): number {
  const chars = new Set([...normalize(title)]);
  let count = 0;
  for (const char of normalize(line)) {
    if (chars.has(char) && char.trim()) count += 1;
  }
  return count;
}

export function pickLyricLine(translated: string, original: string, title: string): string {
  const source = translated.trim() ? translated : original;
  const lines = source
    .split('\n')
    .map((raw) => {
      const matched = raw.match(/^\[(\d{2}):(\d{2})(?:\.\d+)?\]\s*(.*)$/);
      return matched ? cleanLine(matched[3] ?? '') : '';
    })
    .filter((line) => line && !/^by[:：]/i.test(line) && !/作词|作曲|编曲|版权/.test(line));

  const candidates = lines.filter((line) => line.length >= 4 && line.length <= 18);
  if (!candidates.length) return '';

  const ranked = candidates.map((line, index) => {
    let score = 0;
    if (line.length >= 6 && line.length <= 14) score += 4;
    else score += 1;
    const position = index / candidates.length;
    if (position > 0.2 && position < 0.82) score += 2;
    if (/[\u3040-\u30ff\u4e00-\u9fff]/.test(line)) score += 1;
    if (/[a-zA-Z]{3,}/.test(line)) score -= 2;
    score += titleOverlap(line, title) * 2;
    return { line, score };
  });

  ranked.sort((a, b) => b.score - a.score);
  return ranked[0]?.line ?? '';
}

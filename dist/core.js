export const RAMPS = {
  classic: ' .:-=+*#%@',
  detailed: ' .\'`^",:;Il!i~+_-?][}{1)(|\\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$',
  minimal: ' .:#',
  binary: ' 01',
};

export function pixelsToAscii(pixels, width, height, { ramp = RAMPS.classic, contrast = 1.2, invert = false } = {}) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || pixels.length < width * height * 4) throw new Error('Invalid image dimensions.');
  const chars = Array.from(ramp);
  if (chars.length < 2) throw new Error('A character set needs at least two characters.');
  const lines = [];
  for (let y = 0; y < height; y++) {
    let line = '';
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const alpha = pixels[i + 3] / 255;
      const luminance = (pixels[i] * .2126 + pixels[i + 1] * .7152 + pixels[i + 2] * .0722) / 255;
      const composite = luminance * alpha + 1 - alpha;
      let density = Math.min(1, Math.max(0, (1 - composite - .5) * contrast + .5));
      if (invert) density = 1 - density;
      line += chars[Math.round(density * (chars.length - 1))];
    }
    lines.push(line);
  }
  return lines.join('\n');
}

const IGNORE = new Set('a an the of some please make create generate draw show me ascii art image picture illustration photo in style with cute tiny big little detailed realistic simple black white cool beautiful green my i want can you could would like to'.split(' '));
const ALIASES = { kitty: 'cat', kitten: 'cat', cats: 'cat', doggo: 'dog', puppy: 'dog', dogs: 'dog', flowers: 'flower', roses: 'rose', skulls: 'skull', skeletons: 'skeleton', dragons: 'dragon', castles: 'castle', boats: 'boat', trees: 'tree', bunnies: 'rabbit', rabbits: 'rabbit', penguins: 'penguin', trains: 'train', cars: 'car' };

export function cleanPrompt(prompt) {
  return prompt.toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, ' ').split(/\s+/).filter(word => word && !IGNORE.has(word)).join(' ').trim();
}

export function searchLibrary(library, query, limit = Infinity) {
  const cleaned = cleanPrompt(query);
  const normalized = cleaned.split(/\s+/).map(word => ALIASES[word] || word).join(' ');
  if (!normalized) return query.trim() ? [] : library.slice(0, limit);
  const words = normalized.split(/\s+/);
  return library.map(item => {
    const name = item.name.toLowerCase();
    const tags = item.tags.toLowerCase().split(/\s*,\s*/);
    const nameWords = name.split(/[\s-]+/);
    let score = name === normalized ? 200 : 0;
    if (nameWords[0] === normalized) score += 30;
    if (tags.includes(normalized)) score += 42;
    const matched = words.filter(word => nameWords.includes(word) || tags.some(tag => tag.split(/[\s-]+/).includes(word)));
    if (matched.length !== words.length) return { item, score: 0 };
    for (const word of words) {
      if (nameWords.includes(word)) score += 15;
      if (tags.includes(word)) score += 7;
    }
    if (score) score -= Math.min(name.length / 12, 8);
    return { item, score };
  }).filter(x => x.score > 0).sort((a, b) => b.score - a.score).slice(0, limit).map(x => x.item);
}

export function artDimensions(text) {
  const lines = text.split('\n');
  return { width: Math.max(1, ...lines.map(line => line.length)), height: lines.length };
}

export function cycleIndex(index, step, length) {
  return length > 0 ? ((index + step) % length + length) % length : 0;
}

export function outputSize(sourceWidth, sourceHeight, columns) {
  if (!(sourceWidth > 0 && sourceHeight > 0)) throw new Error('This image has no readable dimensions.');
  const width = Math.max(30, Math.min(180, Math.round(columns)));
  const height = Math.max(4, Math.min(180, Math.round(sourceHeight / sourceWidth * width * .577)));
  return { width, height };
}

export function escapeXML(text) {
  return String(text).replace(/[<>&"']/g, ch => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[ch]));
}

export function safeFilename(name) {
  return 'ascii-' + (name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 65) || 'art');
}

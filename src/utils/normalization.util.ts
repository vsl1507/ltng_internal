function hasTooManyShortLines(text: string) {
  const lines = text.split("\n").filter((l) => l.trim().length > 0);
  const shortLines = lines.filter((l) => l.trim().length < 40);
  return shortLines.length / lines.length > 0.5;
}

const NOISE_PATTERNS = [
  /advertisement/i,
  /subscribe/i,
  /sign up/i,
  /related/i,
  /follow us/i,
  /share this/i,
  /©/i,
];

function noiseScore(text: string) {
  return NOISE_PATTERNS.filter((p) => p.test(text)).length;
}

function paragraphSignalRatio(text: string) {
  const paragraphs = text.split(/\n+/).filter((p) => p.trim().length > 0);
  const good = paragraphs.filter((p) => p.length > 120);
  return good.length / Math.max(paragraphs.length, 1);
}

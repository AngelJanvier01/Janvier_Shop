export const fallbackImageFrameColor = "#FFFFFF";

const colorBinSize = 24;
const frameBandRatio = 0.26;
const minimumAccentScore = 0.34;

type ColorRecord = {
  channels: [number[], number[], number[]];
  count: number;
  edgeHits: [number, number, number, number];
};

function median(values: number[]) {
  const ordered = [...values].sort((left, right) => left - right);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2
    ? ordered[middle]
    : Math.round((ordered[middle - 1] + ordered[middle]) / 2);
}

function toHex(value: number) {
  return Math.min(255, Math.max(0, Math.round(value)))
    .toString(16)
    .padStart(2, "0");
}

function edgeCoverage(record: ColorRecord, edgeArea: number) {
  return (
    record.edgeHits.reduce((total, hits) => total + hits / edgeArea, 0) /
    record.edgeHits.length
  );
}

function colorFromRecord(record: ColorRecord) {
  return record.channels.map((channel) => median(channel)) as [number, number, number];
}

function recordHex(record: ColorRecord) {
  return `#${colorFromRecord(record)
    .map((channel) => toHex(channel))
    .join("")
    .toUpperCase()}`;
}

export function imageFrameColorFromRgba(
  pixels: Uint8Array,
  width: number,
  height: number
) {
  if (width < 2 || height < 2 || pixels.length < width * height * 4) {
    return fallbackImageFrameColor;
  }

  const records = new Map<string, ColorRecord>();
  const frameDepth = Math.max(2, Math.round(Math.min(width, height) * frameBandRatio));
  const edgeArea = Math.max(1, frameDepth * Math.max(width, height));

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      const alpha = pixels[offset + 3] / 255;
      const color = [0, 1, 2].map((channel) =>
        Math.round(pixels[offset + channel] * alpha + 255 * (1 - alpha))
      ) as [number, number, number];
      const key = color.map((channel) => Math.round(channel / colorBinSize)).join(",");
      const record = records.get(key) ?? {
        channels: [[], [], []],
        count: 0,
        edgeHits: [0, 0, 0, 0]
      };

      record.count += 1;
      for (let channel = 0; channel < 3; channel += 1) {
        record.channels[channel].push(color[channel]);
      }
      if (y < frameDepth) record.edgeHits[0] += 1;
      if (x >= width - frameDepth) record.edgeHits[1] += 1;
      if (y >= height - frameDepth) record.edgeHits[2] += 1;
      if (x < frameDepth) record.edgeHits[3] += 1;
      records.set(key, record);
    }
  }

  const candidates = [...records.values()];
  const totalPixels = width * height;
  const base = candidates.reduce((best, candidate) => {
    const candidateScore =
      edgeCoverage(candidate, edgeArea) * 0.7 + (candidate.count / totalPixels) * 0.3;
    const bestScore =
      edgeCoverage(best, edgeArea) * 0.7 + (best.count / totalPixels) * 0.3;
    return candidateScore > bestScore ? candidate : best;
  });

  const accent = candidates.reduce<ColorRecord | null>((best, candidate) => {
    const [red, green, blue] = colorFromRecord(candidate);
    const chroma = (Math.max(red, green, blue) - Math.min(red, green, blue)) / 255;
    const sidesCovered = candidate.edgeHits.filter(
      (hits) => hits / edgeArea >= 0.035
    ).length;

    if (chroma < 0.12 || sidesCovered !== 4) return best;

    const candidateScore =
      chroma +
      edgeCoverage(candidate, edgeArea) * 0.35 +
      (candidate.count / totalPixels) * 0.05;
    if (!best) return candidate;

    const [bestRed, bestGreen, bestBlue] = colorFromRecord(best);
    const bestChroma =
      (Math.max(bestRed, bestGreen, bestBlue) - Math.min(bestRed, bestGreen, bestBlue)) /
      255;
    const bestScore =
      bestChroma +
      edgeCoverage(best, edgeArea) * 0.35 +
      (best.count / totalPixels) * 0.05;
    return candidateScore > bestScore ? candidate : best;
  }, null);

  if (accent) {
    const [red, green, blue] = colorFromRecord(accent);
    const accentScore =
      (Math.max(red, green, blue) - Math.min(red, green, blue)) / 255 +
      edgeCoverage(accent, edgeArea) * 0.35 +
      (accent.count / totalPixels) * 0.05;
    if (accentScore >= minimumAccentScore) return recordHex(accent);
  }

  return recordHex(base);
}

export function isImageFrameColor(value: string) {
  return /^#[0-9A-F]{6}$/i.test(value);
}

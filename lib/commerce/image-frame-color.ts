export const fallbackImageFrameColor = "#FFFFFF";

const colorBinSize = 24;
const frameBandRatio = 0.26;
const minimumAccentScore = 0.34;
const minimumAccentSurfaceRatio = 0.1;
const edgeSurfaceMinimumRatio = 0.12;
const edgeSurfaceMinimumFootprint = 0.72;
const edgeSurfaceMinimumSideCoverage = 0.04;
const edgeSurfaceMinimumInteriorCoverage = 0.03;
const neutralMatteMinimumLightness = 0.86;
const neutralMatteMaximumChroma = 0.1;

type ColorRecord = {
  channels: [number[], number[], number[]];
  count: number;
  edgeHits: [number, number, number, number];
};

type EdgeSurface = {
  channels: [number[], number[], number[]];
  count: number;
  edgeHits: [number, number, number, number];
  interiorHits: number;
  maxX: number;
  maxY: number;
  minX: number;
  minY: number;
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

function colorFromChannels(channels: EdgeSurface["channels"]) {
  return channels.map((channel) => median(channel)) as [number, number, number];
}

function recordHex(record: ColorRecord) {
  return `#${colorFromRecord(record)
    .map((channel) => toHex(channel))
    .join("")
    .toUpperCase()}`;
}

function channelsHex(channels: EdgeSurface["channels"]) {
  return `#${colorFromChannels(channels)
    .map((channel) => toHex(channel))
    .join("")
    .toUpperCase()}`;
}

function compositedColor(pixels: Uint8Array, pixelIndex: number) {
  const offset = pixelIndex * 4;
  const alpha = pixels[offset + 3] / 255;
  return [0, 1, 2].map((channel) =>
    Math.round(pixels[offset + channel] * alpha + 255 * (1 - alpha))
  ) as [number, number, number];
}

function colorBucket(color: [number, number, number]) {
  return color.map((channel) => Math.round(channel / colorBinSize)).join(",");
}

function isLightNeutralSurface(surface: EdgeSurface) {
  const [red, green, blue] = colorFromChannels(surface.channels);
  const lightness = (red + green + blue) / (3 * 255);
  const chroma = (Math.max(red, green, blue) - Math.min(red, green, blue)) / 255;
  return lightness >= neutralMatteMinimumLightness && chroma <= neutralMatteMaximumChroma;
}

function edgeSurfaceColor(pixels: Uint8Array, width: number, height: number) {
  const totalPixels = width * height;
  const buckets = new Array<string>(totalPixels);
  const interiorInset = Math.max(2, Math.round(Math.min(width, height) * 0.12));
  const interiorWidth = Math.max(1, width - interiorInset * 2);
  const interiorHeight = Math.max(1, height - interiorInset * 2);
  const interiorArea = interiorWidth * interiorHeight;

  for (let index = 0; index < totalPixels; index += 1) {
    buckets[index] = colorBucket(compositedColor(pixels, index));
  }

  const visited = new Uint8Array(totalPixels);
  let bestEdgeSurface: EdgeSurface | null = null;
  let bestEdgeScore = Number.NEGATIVE_INFINITY;
  let bestMatteSurface: EdgeSurface | null = null;
  let bestMatteScore = Number.NEGATIVE_INFINITY;
  let bestInteriorSurface: EdgeSurface | null = null;
  let bestInteriorScore = Number.NEGATIVE_INFINITY;

  for (let start = 0; start < totalPixels; start += 1) {
    if (visited[start]) continue;

    const queue = [start];
    const bucket = buckets[start];
    const surface: EdgeSurface = {
      channels: [[], [], []],
      count: 0,
      edgeHits: [0, 0, 0, 0],
      interiorHits: 0,
      maxX: 0,
      maxY: 0,
      minX: width,
      minY: height
    };
    visited[start] = 1;

    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const pixelIndex = queue[cursor];
      const x = pixelIndex % width;
      const y = Math.floor(pixelIndex / width);
      const color = compositedColor(pixels, pixelIndex);

      surface.count += 1;
      surface.minX = Math.min(surface.minX, x);
      surface.maxX = Math.max(surface.maxX, x);
      surface.minY = Math.min(surface.minY, y);
      surface.maxY = Math.max(surface.maxY, y);
      for (let channel = 0; channel < 3; channel += 1) {
        surface.channels[channel].push(color[channel]);
      }
      if (y === 0) surface.edgeHits[0] += 1;
      if (x === width - 1) surface.edgeHits[1] += 1;
      if (y === height - 1) surface.edgeHits[2] += 1;
      if (x === 0) surface.edgeHits[3] += 1;
      if (
        x >= interiorInset &&
        x < width - interiorInset &&
        y >= interiorInset &&
        y < height - interiorInset
      ) {
        surface.interiorHits += 1;
      }

      const neighbors = [
        x > 0 ? pixelIndex - 1 : -1,
        x < width - 1 ? pixelIndex + 1 : -1,
        y > 0 ? pixelIndex - width : -1,
        y < height - 1 ? pixelIndex + width : -1
      ];
      for (const neighbor of neighbors) {
        if (neighbor >= 0 && buckets[neighbor] === bucket && !visited[neighbor]) {
          visited[neighbor] = 1;
          queue.push(neighbor);
        }
      }
    }

    const footprintWidth = (surface.maxX - surface.minX + 1) / width;
    const footprintHeight = (surface.maxY - surface.minY + 1) / height;
    const sideCoverage = [
      surface.edgeHits[0] / width,
      surface.edgeHits[1] / height,
      surface.edgeHits[2] / width,
      surface.edgeHits[3] / height
    ];
    const touchesEverySide = sideCoverage.every(
      (coverage) => coverage >= edgeSurfaceMinimumSideCoverage
    );
    if (
      surface.count / totalPixels < edgeSurfaceMinimumRatio ||
      footprintWidth < edgeSurfaceMinimumFootprint ||
      footprintHeight < edgeSurfaceMinimumFootprint
    ) {
      continue;
    }

    const interiorCoverage = surface.interiorHits / interiorArea;
    if (touchesEverySide) {
      const averageSideCoverage =
        sideCoverage.reduce((total, coverage) => total + coverage, 0) / 4;
      if (interiorCoverage >= edgeSurfaceMinimumInteriorCoverage) {
        const edgeScore =
          (surface.count / totalPixels) * 0.45 +
          averageSideCoverage * 0.45 +
          ((footprintWidth + footprintHeight) / 2) * 0.1;
        if (edgeScore > bestEdgeScore) {
          bestEdgeScore = edgeScore;
          bestEdgeSurface = surface;
        }
      } else if (isLightNeutralSurface(surface)) {
        const matteScore =
          (surface.count / totalPixels) * 0.7 + averageSideCoverage * 0.3;
        if (matteScore > bestMatteScore) {
          bestMatteScore = matteScore;
          bestMatteSurface = surface;
        }
      }
      continue;
    }

    const interiorScore =
      (surface.count / totalPixels) * 0.65 +
      ((footprintWidth + footprintHeight) / 2) * 0.2 +
      interiorCoverage * 0.15;
    if (interiorScore > bestInteriorScore) {
      bestInteriorScore = interiorScore;
      bestInteriorSurface = surface;
    }
  }

  const selectedSurface = bestEdgeSurface ?? bestMatteSurface ?? bestInteriorSurface;
  return selectedSurface ? channelsHex(selectedSurface.channels) : null;
}

export function imageFrameColorFromRgba(
  pixels: Uint8Array,
  width: number,
  height: number
) {
  if (width < 2 || height < 2 || pixels.length < width * height * 4) {
    return fallbackImageFrameColor;
  }

  const detectedEdgeSurface = edgeSurfaceColor(pixels, width, height);
  if (detectedEdgeSurface) return detectedEdgeSurface;

  const records = new Map<string, ColorRecord>();
  const frameDepth = Math.max(2, Math.round(Math.min(width, height) * frameBandRatio));
  const edgeArea = Math.max(1, frameDepth * Math.max(width, height));

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const color = compositedColor(pixels, y * width + x);
      const key = colorBucket(color);
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

    if (
      candidate.count / totalPixels < minimumAccentSurfaceRatio ||
      chroma < 0.12 ||
      sidesCovered !== 4
    ) {
      return best;
    }

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

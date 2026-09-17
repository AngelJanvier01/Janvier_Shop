const imageSurface = [247, 247, 244] as const;
const samplePoints = [
  [1, 1],
  [10, 1],
  [18, 1],
  [1, 10],
  [18, 10],
  [1, 18],
  [10, 18],
  [18, 18]
] as const;
const sampleSize = 20;
const sampledColors = new Map<string, string>();

export function getImageFrameColor(image: HTMLImageElement) {
  const source = image.currentSrc || image.src;
  const cachedColor = sampledColors.get(source);
  if (cachedColor) return cachedColor;

  try {
    const canvas = document.createElement("canvas");
    canvas.width = sampleSize;
    canvas.height = sampleSize;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return null;

    context.drawImage(image, 0, 0, sampleSize, sampleSize);
    const pixels = context.getImageData(0, 0, sampleSize, sampleSize).data;
    const color = imageSurface.map(() => 0);

    for (const [x, y] of samplePoints) {
      const offset = (y * sampleSize + x) * 4;
      const alpha = pixels[offset + 3] / 255;

      for (let channel = 0; channel < color.length; channel += 1) {
        color[channel] += pixels[offset + channel] * alpha + imageSurface[channel] * (1 - alpha);
      }
    }

    const frameColor = `rgb(${color.map((value) => Math.round(value / samplePoints.length)).join(" ")})`;
    sampledColors.set(source, frameColor);
    return frameColor;
  } catch {
    // Algunas imágenes remotas no permiten leer sus píxeles. Conservamos el marco claro.
    return null;
  }
}

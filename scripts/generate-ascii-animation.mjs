import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const sourcePalette = " .:-=+*#%@";
const outputSize = 72;
const outputFrames = 18;
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const rootDirectory = path.resolve(scriptDirectory, "..");
const [sourceArgument, outputArgument] = process.argv.slice(2);
const sourcePath = path.resolve(rootDirectory, sourceArgument ?? "gif/ascii-frames.json");
const outputPath = path.resolve(
  rootDirectory,
  outputArgument ?? "public/ascii/operation-flow-v1.json"
);
const outputDirectory = path.dirname(outputPath);

function luminance(character) {
  const index = sourcePalette.indexOf(character);
  return index === -1 ? 0 : index / (sourcePalette.length - 1);
}

function resampleFrame(frame) {
  const sourceHeight = frame.length;
  const sourceWidth = Math.max(...frame.map((line) => line.length));

  return Array.from({ length: outputSize }, (_, outputY) => {
    const startY = Math.floor((outputY * sourceHeight) / outputSize);
    const endY = Math.max(startY + 1, Math.floor(((outputY + 1) * sourceHeight) / outputSize));

    return Array.from({ length: outputSize }, (_, outputX) => {
      const startX = Math.floor((outputX * sourceWidth) / outputSize);
      const endX = Math.max(startX + 1, Math.floor(((outputX + 1) * sourceWidth) / outputSize));
      let total = 0;
      let count = 0;

      for (let sourceY = startY; sourceY < endY; sourceY += 1) {
        for (let sourceX = startX; sourceX < endX; sourceX += 1) {
          total += luminance(frame[sourceY][sourceX] ?? " ");
          count += 1;
        }
      }

      return sourcePalette[Math.round((total / count) * (sourcePalette.length - 1))];
    }).join("");
  });
}

const sourceFrames = JSON.parse(await readFile(sourcePath, "utf8"));
const frames = Array.from({ length: outputFrames }, (_, index) => {
  const sourceIndex = Math.round((index * (sourceFrames.length - 1)) / (outputFrames - 1));
  return resampleFrame(sourceFrames[sourceIndex]);
});

await mkdir(outputDirectory, { recursive: true });
await writeFile(outputPath, `${JSON.stringify(frames)}\n`);

console.log(`Generated ${frames.length} frames at ${outputSize}×${outputSize}: ${outputPath}`);

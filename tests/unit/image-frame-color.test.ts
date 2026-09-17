import { describe, expect, it } from "vitest";

import { imageFrameColorFromRgba } from "@/lib/commerce/image-frame-color";

function pixels(width: number, height: number, color: [number, number, number, number]) {
  const value = new Uint8Array(width * height * 4);
  for (let index = 0; index < value.length; index += 4) {
    value.set(color, index);
  }
  return value;
}

describe("imageFrameColorFromRgba", () => {
  it("uses the dominant color around the image frame", () => {
    const value = pixels(24, 24, [198, 202, 205, 255]);
    value.set([0, 0, 0, 255], 0);

    expect(imageFrameColorFromRgba(value, 24, 24)).toBe("#C6CACD");
  });

  it("prefers a colored frame that surrounds a dark product", () => {
    const value = pixels(64, 64, [38, 40, 40, 255]);

    for (let y = 8; y < 56; y += 1) {
      for (let x = 8; x < 56; x += 1) {
        if (x < 12 || x >= 52 || y < 12 || y >= 52) {
          const offset = (y * 64 + x) * 4;
          value.set([150, 38, 138, 255], offset);
        }
      }
    }

    expect(imageFrameColorFromRgba(value, 64, 64)).toBe("#96268A");
  });

  it("uses a large white image surface instead of its darker outer frame", () => {
    const value = pixels(96, 96, [73, 71, 70, 255]);

    for (let y = 10; y < 86; y += 1) {
      for (let x = 10; x < 86; x += 1) {
        const offset = (y * 96 + x) * 4;
        value.set([255, 255, 255, 255], offset);
      }
    }
    for (let y = 30; y < 66; y += 1) {
      for (let x = 30; x < 66; x += 1) {
        const offset = (y * 96 + x) * 4;
        value.set([34, 34, 34, 255], offset);
      }
    }

    expect(imageFrameColorFromRgba(value, 96, 96)).toBe("#FFFFFF");
  });

  it("uses any broad source surface, without depending on a specific color", () => {
    const value = pixels(96, 96, [52, 99, 143, 255]);

    for (let y = 28; y < 68; y += 1) {
      for (let x = 28; x < 68; x += 1) {
        const offset = (y * 96 + x) * 4;
        value.set([25, 27, 29, 255], offset);
      }
    }

    expect(imageFrameColorFromRgba(value, 96, 96)).toBe("#34638F");
  });

  it("ignores a thin colored edge around a broad image surface", () => {
    const value = pixels(96, 96, [255, 255, 255, 255]);

    for (let y = 0; y < 96; y += 1) {
      for (let x = 0; x < 96; x += 1) {
        if (x < 2 || x >= 94 || y < 2 || y >= 94) {
          const offset = (y * 96 + x) * 4;
          value.set([169, 28, 157, 255], offset);
        }
      }
    }

    expect(imageFrameColorFromRgba(value, 96, 96)).toBe("#FFFFFF");
  });

  it("keeps a broad, neutral source matte even if the product covers its center", () => {
    const value = pixels(96, 96, [255, 255, 255, 255]);

    for (let y = 10; y < 86; y += 1) {
      for (let x = 10; x < 86; x += 1) {
        const offset = (y * 96 + x) * 4;
        value.set([49, 49, 49, 255], offset);
      }
    }

    expect(imageFrameColorFromRgba(value, 96, 96)).toBe("#FFFFFF");
  });

  it("composites transparent image corners over the white image surface", () => {
    expect(imageFrameColorFromRgba(pixels(24, 24, [0, 0, 0, 0]), 24, 24)).toBe("#FFFFFF");
  });
});

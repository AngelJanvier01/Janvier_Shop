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

  it("composites transparent image corners over the white image surface", () => {
    expect(imageFrameColorFromRgba(pixels(24, 24, [0, 0, 0, 0]), 24, 24)).toBe("#FFFFFF");
  });
});

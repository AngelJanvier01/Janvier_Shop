import unittest

from PIL import Image, ImageDraw

from app import prepare_image, protect_product_silhouette


class ProductMaskGuardTests(unittest.TestCase):
    def test_letterbox_preserves_wide_product_geometry(self):
        tensor, geometry = prepare_image(Image.new("RGB", (400, 200), "white"))

        self.assertEqual(tuple(tensor.shape), (1, 3, 1024, 1024))
        self.assertEqual(geometry, (0, 256, 1024, 512))

    def test_light_background_guard_recovers_complete_connected_product(self):
        image = Image.new("RGB", (320, 240), "white")
        drawing = ImageDraw.Draw(image)
        drawing.rectangle((0, 30, 20, 210), fill="black")  # unrelated side bar
        drawing.rectangle((40, 35, 280, 165), fill="#151515")
        drawing.rectangle((48, 43, 272, 157), fill="#043565")
        drawing.rectangle((105, 70, 215, 145), fill="#e33b20")
        drawing.rectangle((135, 90, 180, 110), fill="white")  # enclosed logo
        drawing.rectangle((145, 165, 175, 205), fill="#181818")
        drawing.rectangle((110, 202, 210, 220), fill="#181818")

        incomplete_ai_mask = Image.new("L", image.size, 0)
        ai_drawing = ImageDraw.Draw(incomplete_ai_mask)
        ai_drawing.rectangle((105, 70, 215, 145), fill=255)
        ai_drawing.rectangle((145, 165, 175, 205), fill=255)
        ai_drawing.rectangle((110, 202, 210, 220), fill=255)

        guarded, mode = protect_product_silhouette(image, incomplete_ai_mask)

        self.assertEqual(mode, "hybrid-light-background")
        self.assertGreater(guarded.getpixel((42, 40)), 240)  # monitor frame
        self.assertGreater(guarded.getpixel((150, 100)), 240)  # enclosed logo
        self.assertLess(guarded.getpixel((10, 100)), 10)  # unrelated side bar
        self.assertLess(guarded.getpixel((310, 230)), 10)  # outer background

    def test_uniform_colored_background_guard_preserves_dark_product_body(self):
        image = Image.new("RGB", (320, 220), "#9b278f")
        drawing = ImageDraw.Draw(image)
        drawing.rounded_rectangle((20, 15, 300, 205), radius=18, fill="#161616")
        drawing.rounded_rectangle((55, 45, 270, 175), radius=12, fill="#3574ba")
        drawing.rectangle((55, 45, 125, 175), fill="#ee2631")

        label_only_mask = Image.new("L", image.size, 0)
        ImageDraw.Draw(label_only_mask).rounded_rectangle(
            (55, 45, 270, 175), radius=12, fill=255
        )

        guarded, mode = protect_product_silhouette(image, label_only_mask)

        self.assertEqual(mode, "hybrid-uniform-background")
        self.assertGreater(guarded.getpixel((25, 25)), 240)  # dark product body
        self.assertLess(guarded.getpixel((5, 5)), 10)  # purple background

    def test_complex_background_keeps_original_when_cutout_is_too_small(self):
        image = Image.new("RGB", (320, 240), "white")
        drawing = ImageDraw.Draw(image)
        colors = ("#c92b32", "#244a70", "#2d8748", "#e6b22d")
        for y in range(0, 240, 20):
            for x in range(0, 320, 20):
                drawing.rectangle(
                    (x, y, x + 19, y + 19),
                    fill=colors[((x // 20) + (y // 20)) % len(colors)],
                )
        tiny_mask = Image.new("L", image.size, 0)
        ImageDraw.Draw(tiny_mask).rectangle((130, 100, 190, 140), fill=255)

        guarded, mode = protect_product_silhouette(image, tiny_mask)

        self.assertEqual(mode, "source-complex-background-fallback")
        self.assertEqual(guarded.getextrema(), (255, 255))


if __name__ == "__main__":
    unittest.main()

# HEIC decoder fixture

`decoder-colors.heic` is an original 64 × 32 two-color image, generated for these
tests with Pillow and pillow-heif 1.8.1. It contains no external artwork or photo.
The left half is RGB `(220, 60, 30)`; the right half is `(25, 90, 220)`.
The previous heic2any decoder produced approximately `(233, 52, 18)` and
`(12, 86, 234)`. heic-to 1.6.6 (libheif 1.23.6) and Pillow both decode it as
`(219, 60, 30)` and `(25, 90, 220)`. Tests compare directly against source colors,
with an RGB tolerance of 3 for HEIC-to-PNG and 6 for lossy JPEG fallback.
The ordinary PNG control must match exactly. The original HEIC bytes are unchanged.
The old display implementation used fixed `1.164 * (Y - 16)` conversion and wrote
alpha as 255. The replacement asks libheif for interleaved RGBA output.

Generate it with this script (the encoder is only a fixture-generation tool,
not a project dependency):

```python
from PIL import Image, ImageDraw
import pillow_heif

pillow_heif.register_heif_opener()
image = Image.new("RGB", (64, 32), (220, 60, 30))
ImageDraw.Draw(image).rectangle((32, 0, 63, 31), fill=(25, 90, 220))
image.save("decoder-colors.heic", format="HEIF", quality=90)
```

`decoder-tones.heic` is a 256 × 32 RGBA image with six gray levels (0, 16, 64,
128, 235, 255), a half-transparent red patch, and a transparent blue patch.
Its nclx metadata declares BT.709 primaries, sRGB transfer, BT.601 matrix and
`full_range_flag=1`. Pillow decodes the gray values exactly and the red patch as
`(219, 60, 30, 128)`. Browser tests allow RGB error up to 2 for gray and 3 for red;
alpha must match exactly. Fully transparent canvas pixels are `(0, 0, 0, 0)`.

```python
colors = [(v, v, v, 255) for v in (0, 16, 64, 128, 235, 255)]
colors += [(220, 60, 30, 128), (25, 90, 220, 0)]
tones = Image.new("RGBA", (256, 32))
draw = ImageDraw.Draw(tones)
for i, color in enumerate(colors):
    draw.rectangle((i * 32, 0, i * 32 + 31, 31), fill=color)
tones.save("decoder-tones.heic", format="HEIF", quality=100, chroma="444")
```

`decoder-sequence.heic` contains the original 64 × 32 two-color still followed
by a 32 × 64 green still. It verifies first-frame selection using actual decoding.

```python
image.save(
    "decoder-sequence.heic", format="HEIF", quality=90, save_all=True,
    append_images=[Image.new("RGB", (32, 64), (25, 200, 60))], primary_index=0,
)
```

These are SDR fixtures. They do not validate arbitrary ICC profiles, wide-gamut
images, HDR tone mapping or Live Photo video. JPEG fallback does not preserve alpha.

# HEIC decoder fixture

`decoder-colors.heic` is an original 64 × 32 two-color image, generated for these
tests with Pillow and pillow-heif 1.8.1. It contains no external artwork or photo.
The left half is RGB `(220, 60, 30)`; the right half is `(25, 90, 220)`.
The current heic2any/libheif decoder produces approximately `(233, 52, 18)` and
`(12, 86, 234)` from this sample. This is a known color-range discrepancy: Pillow
round-trips the source as `(219, 60, 30)` and `(25, 90, 220)`. The browser tests use
the existing decoder output as the baseline for input routing and PNG/JPEG
fallbacks; they do not establish HEIC color accuracy. A codec/color-management
follow-up should correct the discrepancy and update this baseline.

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

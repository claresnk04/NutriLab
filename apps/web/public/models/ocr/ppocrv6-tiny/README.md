# PP-OCRv6 tiny browser artifacts

This directory is populated by `tools/ocr-conversion/convert_models.py`.

Expected production files:

- `det.onnx`
- `rec.onnx`
- `rec_dict.txt`
- `manifest.json`

The application intentionally reports a clear model-loading error until these
files are present; no fake model is bundled.

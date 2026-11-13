# OCR model conversion

This directory contains the reproducible PaddleOCR → ONNX conversion workflow.
The runtime application uses `onnxruntime-web`; it does not need PaddlePaddle.

## Prerequisites

Use Docker Desktop with the WSL2 backend. The converter image pins Python 3.12
so the host Python installation is not involved.

```powershell
docker build -f tools/ocr-conversion/Dockerfile `
  -t nutri-lab-ocr-converter:py312 tools/ocr-conversion
```

Download or export the exact `PP-OCRv6_tiny_det` and `PP-OCRv6_tiny_rec`
inference model directories into `tools/ocr-conversion/models/paddle/`. Each
directory must contain the current Paddle inference files (`inference.json` and
`inference.pdiparams`).

Run from the repository root:

```powershell
docker run --rm `
  --name nutri-lab-ocr-conversion `
  -v "${PWD}:/workspace" `
  -w /workspace `
  nutri-lab-ocr-converter:py312 `
  tools/ocr-conversion/convert_models.py
```

The script writes ONNX artifacts to `apps/web/public/models/ocr/ppocrv6-tiny/`.
It also runs ONNX checker and a CPU smoke inference for each model. Do not commit
the Paddle source model or cache directories; the browser only needs the ONNX
files and recognition dictionary.

The conversion is intentionally separate from the web build. If a Paddle2ONNX
operator is unsupported, the web application must not silently ship a broken
model.

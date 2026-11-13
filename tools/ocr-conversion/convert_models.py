"""Convert PP-OCRv6 inference models and validate the ONNX artifacts."""

from __future__ import annotations

import os
import shutil
import site
import sys
from pathlib import Path

import numpy as np
import onnx
import onnxruntime as ort
import yaml

if sys.platform == "win32":
    site_root = Path(site.getsitepackages()[0])
    for dll_dir in (site_root / "paddle" / "base", site_root / "paddle" / "libs"):
        if dll_dir.is_dir():
            os.add_dll_directory(str(dll_dir))

import paddle2onnx

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "tools" / "ocr-conversion" / "models" / "paddle"
OUTPUT = ROOT / "apps" / "web" / "public" / "models" / "ocr" / "ppocrv6-tiny"

MODELS = {
    "det": SOURCE / "PP-OCRv6_tiny_det",
    "rec": SOURCE / "PP-OCRv6_tiny_rec",
}


def convert(name: str, model_dir: Path) -> None:
    if not model_dir.is_dir():
        raise FileNotFoundError(f"Model directory tidak ditemukan: {model_dir}")

    model_file = model_dir / "inference.json"
    params_file = model_dir / "inference.pdiparams"
    if not model_file.exists() or not params_file.exists():
        raise FileNotFoundError(
            f"{model_dir} harus berisi inference.json dan inference.pdiparams"
        )

    output_file = OUTPUT / f"{name}.onnx"
    print(f"Converting {name}: {model_dir}")
    paddle2onnx.export(
        model_filename=str(model_file),
        params_filename=str(params_file),
        save_file=str(output_file),
        opset_version=11,
        enable_onnx_checker=True,
    )
    onnx.checker.check_model(str(output_file))
    session = ort.InferenceSession(str(output_file), providers=["CPUExecutionProvider"])
    input_meta = session.get_inputs()[0]
    output_shapes = [list(output.shape) for output in session.get_outputs()]
    print(f"{name} input: {input_meta.name} {list(input_meta.shape)}")
    print(f"{name} outputs: {output_shapes}")
    shape = [1 if isinstance(value, str) or value is None else int(value) for value in input_meta.shape]
    if len(shape) == 4:
        shape[0] = 1
        shape[1] = 3
        if name == "det":
            shape[2] = 736
            shape[3] = 736
        else:
            shape[2] = 48
            shape[3] = 320
    sample = np.zeros(shape, dtype=np.float32)
    session.run(None, {input_meta.name: sample})
    print(f"Validated {output_file.name} ({output_file.stat().st_size // 1024} KiB)")


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for name, model_dir in MODELS.items():
        convert(name, model_dir)

    dictionary = SOURCE / "rec_dict.txt"
    characters = []
    if dictionary.exists():
        characters = dictionary.read_text(encoding="utf-8").splitlines()
    if len(characters) < 100:
        config = yaml.safe_load((MODELS["rec"] / "inference.yml").read_text(encoding="utf-8"))
        characters = config["PostProcess"]["character_dict"]
    if len(characters) < 100:
        raise ValueError("Kamus OCR tidak valid atau terlalu pendek.")
    (OUTPUT / "rec_dict.txt").write_text("\n".join(characters) + "\n", encoding="utf-8")
    print(f"Recognition dictionary: {len(characters)} entries")

    (OUTPUT / "manifest.json").write_text(
        '{\n  "version": "ppocrv6-tiny-v1",\n  "detector": "det.onnx",\n  "recognizer": "rec.onnx",\n  "dictionary": "rec_dict.txt"\n}\n',
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()

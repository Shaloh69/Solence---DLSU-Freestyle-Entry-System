"""Datasets and training runs follow SOLENCE_VISION_DATA; weights stay in the repo.

The laptop keeps the repo on D: (too small for CubiCasa5K + converted copies
+ runs), so the data root must be movable without touching the scripts.
"""

from __future__ import annotations

import importlib
import sys
from pathlib import Path

import pytest

SCRIPTS = Path(__file__).resolve().parent.parent / "scripts"
BASE_DIR = SCRIPTS.parent


def load_common(monkeypatch: pytest.MonkeyPatch, data_root: Path | None):
    if data_root is None:
        monkeypatch.delenv("SOLENCE_VISION_DATA", raising=False)
    else:
        monkeypatch.setenv("SOLENCE_VISION_DATA", str(data_root))
    monkeypatch.syspath_prepend(str(SCRIPTS))
    sys.modules.pop("_common", None)
    return importlib.import_module("_common")


def test_data_and_runs_follow_env(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    common = load_common(monkeypatch, tmp_path)
    assert common.DATA_RAW == tmp_path / "raw"
    assert common.DATA_YOLO == tmp_path / "yolo"
    assert common.DATA_UNET == tmp_path / "unet"
    assert common.DATA_PREVIEWS == tmp_path / "_previews"
    assert common.RUNS == tmp_path / "runs"
    # Served weights stay next to the app, whatever the data root.
    assert common.MODELS_YOLO == BASE_DIR / "models" / "yolo"
    assert common.MODELS_UNET == BASE_DIR / "models" / "unet"


def test_default_is_repo_data_dir(monkeypatch: pytest.MonkeyPatch) -> None:
    common = load_common(monkeypatch, None)
    assert common.DATA_RAW == BASE_DIR / "data" / "raw"
    assert common.RUNS == BASE_DIR / "data" / "runs"

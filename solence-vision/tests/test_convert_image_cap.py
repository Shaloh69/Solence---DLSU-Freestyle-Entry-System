"""convert_to_yolo caps image size so training workers don't run out of RAM.

Some CubiCasa5K F1_scaled.png files are ~90 MP; decoding them in 8 dataloader
workers killed the laptop run at epoch 2 (V0b). YOLO labels are normalized,
so a proportionally downscaled image keeps them valid.
"""

from __future__ import annotations

import importlib
import sys
from pathlib import Path

import pytest
from PIL import Image

SCRIPTS = Path(__file__).resolve().parent.parent / "scripts"


@pytest.fixture()
def convert(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.syspath_prepend(str(SCRIPTS))
    sys.modules.pop("convert_to_yolo", None)
    return importlib.import_module("convert_to_yolo")


def make_png(path: Path, size: tuple[int, int]) -> None:
    image = Image.new("RGB", size, "white")
    image.paste((0, 0, 0), (0, size[1] // 2, size[0], size[1] // 2 + 4))  # a "wall"
    image.save(path)


def test_large_image_is_downscaled_and_source_untouched(convert, tmp_path: Path) -> None:
    source = tmp_path / "F1_scaled.png"
    make_png(source, (4096, 1024))
    before = source.read_bytes()

    target = tmp_path / "out.png"
    convert.place_image(source, target, max_side=2048)

    with Image.open(target) as out:
        assert out.size == (2048, 512)  # aspect kept, so normalized labels stay valid
    assert source.read_bytes() == before
    assert not source.samefile(target)


def test_small_image_is_linked_or_copied_unchanged(convert, tmp_path: Path) -> None:
    source = tmp_path / "small.png"
    make_png(source, (800, 600))

    target = tmp_path / "out.png"
    convert.place_image(source, target, max_side=2048)

    assert target.read_bytes() == source.read_bytes()


def test_capped_size_keeps_aspect(convert) -> None:
    assert convert.capped_size(10000, 9035, 2048) == (2048, 1850)
    assert convert.capped_size(1000, 500, 2048) == (1000, 500)

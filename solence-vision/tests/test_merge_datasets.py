"""merge_datasets.py unit tests over tiny synthetic sources (§7.1)."""

from __future__ import annotations

import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))

from cubicasa_svg import CLASSES
from merge_datasets import build_index_map, read_names, remap_label_file


def test_read_names_roundtrip(tmp_path: Path):
    yaml = tmp_path / "data.yaml"
    yaml.write_text(
        "path: /x\ntrain: images/train\nval: images/val\nnames:\n"
        "  0: door\n  1: window\n  2: room_kitchen\n",
        encoding="utf-8",
    )
    assert read_names(yaml) == ["door", "window", "room_kitchen"]


def test_identity_map_for_unified_source():
    # A source already converted with the unified CLASSES maps 1:1.
    index_map = build_index_map("cubicasa5k", list(CLASSES))
    assert index_map == {i: i for i in range(len(CLASSES))}


def test_rplan_names_remap_onto_unified_indices():
    names = ["living room", "dining room", "balcony", "wall", "door"]
    index_map = build_index_map("rplan", names)

    assert index_map[0] == CLASSES.index("room_living")
    assert index_map[1] == CLASSES.index("room_dining")
    assert index_map[2] == CLASSES.index("room_outdoor")
    assert index_map[3] is None  # walls come from the U-Net head, dropped here
    assert index_map[4] == CLASSES.index("door")


def test_unknown_class_in_unmapped_source_is_dropped():
    index_map = build_index_map("someset", ["mystery_class", "door"])
    assert index_map[0] is None
    assert index_map[1] == CLASSES.index("door")


def test_remap_label_file_rewrites_indices_and_counts(tmp_path: Path):
    src = tmp_path / "in.txt"
    dst = tmp_path / "out.txt"
    # Source indices: 0 = dining room -> room_dining, 1 = wall -> dropped.
    src.write_text("0 0.1 0.1 0.9 0.1 0.9 0.9\n1 0 0 1 0 1 1\n", encoding="utf-8")
    index_map = {0: CLASSES.index("room_dining"), 1: None}

    counts = remap_label_file(src, dst, index_map)

    assert counts == Counter({"room_dining": 1})
    lines = dst.read_text(encoding="utf-8").strip().splitlines()
    assert len(lines) == 1
    assert lines[0].split()[0] == str(CLASSES.index("room_dining"))

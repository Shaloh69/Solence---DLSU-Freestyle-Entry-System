"""Merge converted YOLO datasets into one training corpus (Phase 2 §7.1).

Each source dataset keeps its own native class list; this script remaps
every source's label indices onto the unified taxonomy (cubicasa_svg.py
CLASSES), stratifies the train/val split so validation pulls
proportionally from every source, and oversamples small sources by
listing their images multiple times in the emitted train list —
Ultralytics has no native per-source sampling weights, and duplicate
list entries achieve the same effect with no file copies.

Prerequisite: each source was already converted by convert_to_yolo.py
into data/yolo/<source>/ (images/{train,val} + labels/{train,val}).

Usage:
    python scripts/merge_datasets.py --sources cubicasa5k resplan \
        [--oversample cubicasa5k=1 resplan=4] [--dry-run] [--force]

Output: data/yolo/merged/ with source-prefixed filenames
(`cubicasa5k__1234.png`) so per-source validation metrics stay
computable after training, plus data.yaml + train.txt/val.txt lists.
"""

from __future__ import annotations

import argparse
import shutil
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from _common import DATA_YOLO, die, versioned_output
from cubicasa_svg import CLASSES

# Per-source class remap: source-native class name -> unified class name
# (or None to drop). Sources whose convert step already used the unified
# CLASSES (cubicasa5k) map 1:1 automatically. Add a table here when a
# new source with its own taxonomy lands (RPLAN, Roboflow sets, …).
SOURCE_CLASS_MAPS: dict[str, dict[str, str | None]] = {
    # RPLAN-style names (§6.2), for when the by-request dataset lands:
    "rplan": {
        "living room": "room_living",
        "master room": "room_bedroom",
        "second room": "room_bedroom",
        "guest room": "room_bedroom",
        "child room": "room_bedroom",
        "study room": "room_other",
        "dining room": "room_dining",
        "kitchen": "room_kitchen",
        "bathroom": "room_bathroom",
        "balcony": "room_outdoor",
        "storage": "room_storage",
        "entrance": "room_hallway",
        "wall": None,
        "door": "door",
        "window": "window",
    },
    # FloorPlanCAD (Phase 3 §1.2 primary furniture source) — movable
    # furniture maps onto the unified furniture taxonomy; fixed plumbing
    # fixtures are dropped (they're not Phase 1 §11.1 furniture and the
    # compliance engine has no use for them yet).
    "floorplancad": {
        "sofa": "furniture_sofa",
        "bed": "furniture_bed",
        "chair": "furniture_chair",
        "table": "furniture_table",
        "bedside_cupboard": "furniture_cabinet",
        "tv_cabinet": "furniture_cabinet",
        "half_height_cabinet": "furniture_cabinet",
        "high_cabinet": "furniture_cabinet",
        "wardrobe": "furniture_cabinet",
        "sink": None,
        "bath": None,
        "bath_tub": None,
        "squat_toilet": None,
        "urinal": None,
        "toilet": None,
        "elevator": None,
        "escalator": None,
        "door": "door",
        "window": "window",
    },
    # SESYD/SFPI synthetic plans (§1.2 bulk volume; sim-to-real gap —
    # pretraining supplement, not a substitute for real sources).
    "sfpi": {
        "sofa": "furniture_sofa",
        "armchair": "furniture_chair",
        "bed": "furniture_bed",
        "table": "furniture_table",
        "table1": "furniture_table",
        "table2": "furniture_table",
        "table3": "furniture_table",
        "sink": None,
        "sink1": None,
        "sink2": None,
        "sink3": None,
        "sink4": None,
        "tub": None,
        "door": "door",
        "door1": "door",
        "door2": "door",
        "window": "window",
        "window1": "window",
        "window2": "window",
    },
}


def read_names(data_yaml: Path) -> list[str]:
    """Class list out of a converted dataset's data.yaml, index-ordered."""
    names: dict[int, str] = {}
    in_names = False

    for line in data_yaml.read_text(encoding="utf-8").splitlines():
        if line.strip() == "names:":
            in_names = True
            continue
        if in_names:
            if not line.startswith(" "):
                break
            index_str, _, name = line.strip().partition(":")
            try:
                names[int(index_str)] = name.strip()
            except ValueError:
                break

    return [names[index] for index in sorted(names)]


def build_index_map(source: str, source_names: list[str]) -> dict[int, int | None]:
    """source label index -> unified CLASSES index (None = drop)."""
    class_map = SOURCE_CLASS_MAPS.get(source, {})
    index_map: dict[int, int | None] = {}

    for index, name in enumerate(source_names):
        unified = class_map.get(name, name if name in CLASSES else None)

        if unified is None:
            index_map[index] = None
        elif unified in CLASSES:
            index_map[index] = CLASSES.index(unified)
        else:
            die(
                f"{source}: class '{name}' maps to '{unified}' which is not in "
                "the unified CLASSES — fix SOURCE_CLASS_MAPS."
            )

    return index_map


def remap_label_file(src: Path, dst: Path, index_map: dict[int, int | None]) -> Counter:
    """Rewrite one YOLO label file with unified indices; returns class counts."""
    counts: Counter = Counter()
    lines_out: list[str] = []

    for line in src.read_text(encoding="utf-8").splitlines():
        parts = line.split()
        if not parts:
            continue
        mapped = index_map.get(int(parts[0]))
        if mapped is None:
            continue
        lines_out.append(" ".join([str(mapped), *parts[1:]]))
        counts[CLASSES[mapped]] += 1

    dst.write_text("\n".join(lines_out) + ("\n" if lines_out else ""), encoding="utf-8")

    return counts


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sources", nargs="+", required=True)
    parser.add_argument(
        "--oversample",
        nargs="*",
        default=[],
        help="source=N repeats in train.txt (default 1); e.g. resplan=4",
    )
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    repeats = {source: 1 for source in args.sources}
    for spec in args.oversample:
        source, _, count = spec.partition("=")
        if source not in repeats or not count.isdigit() or int(count) < 1:
            die(f"Bad --oversample entry '{spec}' (expected source=N, N>=1)")
        repeats[source] = int(count)

    converted: dict[str, Path] = {}
    for source in args.sources:
        root = DATA_YOLO / source
        if not (root / "data.yaml").exists():
            die(
                f"{root}/data.yaml missing — run "
                f"'python scripts/convert_to_yolo.py --dataset {source}' first."
            )
        converted[source] = root

    if args.dry_run:
        print("dry run — per-source class counts after remap:\n")

    out_dir = None
    if not args.dry_run:
        out_dir = versioned_output(DATA_YOLO, "merged", args.force)
        for split in ("train", "val"):
            (out_dir / "images" / split).mkdir(parents=True, exist_ok=True)
            (out_dir / "labels" / split).mkdir(parents=True, exist_ok=True)

    grand_counts: dict[str, Counter] = {}
    train_list: list[str] = []
    val_list: list[str] = []

    for source, root in converted.items():
        source_names = read_names(root / "data.yaml")
        index_map = build_index_map(source, source_names)
        source_counts: Counter = Counter()

        for split in ("train", "val"):
            images = sorted((root / "images" / split).glob("*"))

            for image in images:
                label = root / "labels" / split / f"{image.stem}.txt"
                prefixed = f"{source}__{image.name}"

                if args.dry_run:
                    if label.exists():
                        for line in label.read_text(encoding="utf-8").splitlines():
                            parts = line.split()
                            if not parts:
                                continue
                            mapped = index_map.get(int(parts[0]))
                            if mapped is not None:
                                source_counts[CLASSES[mapped]] += 1
                    continue

                assert out_dir is not None
                shutil.copy2(image, out_dir / "images" / split / prefixed)
                dst_label = (
                    out_dir / "labels" / split / f"{source}__{image.stem}.txt"
                )
                if label.exists():
                    source_counts += remap_label_file(label, dst_label, index_map)
                else:
                    dst_label.write_text("", encoding="utf-8")

                entry = (out_dir / "images" / split / prefixed).resolve().as_posix()

                if split == "train":
                    train_list.extend([entry] * repeats[source])
                else:
                    val_list.append(entry)

        grand_counts[source] = source_counts
        print(f"{source} (x{repeats[source]} in train):")
        for name in CLASSES:
            if source_counts[name]:
                print(f"  {name:<16}{source_counts[name]:>8}")
        print()

    if args.dry_run:
        return

    assert out_dir is not None
    (out_dir / "train.txt").write_text("\n".join(train_list) + "\n", encoding="utf-8")
    (out_dir / "val.txt").write_text("\n".join(val_list) + "\n", encoding="utf-8")
    root_posix = out_dir.resolve().as_posix()
    (out_dir / "data.yaml").write_text(
        f"path: {root_posix}\ntrain: train.txt\nval: val.txt\nnames:\n"
        + "\n".join(f"  {index}: {name}" for index, name in enumerate(CLASSES)),
        encoding="utf-8",
    )
    print(f"Merged dataset at {out_dir}")
    print("Next: python scripts/verify_dataset.py --dataset merged --kind yolo")


if __name__ == "__main__":
    main()

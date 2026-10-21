"""ResPlan -> Solence FloorPlan converter (STATE item W1).

Source: ResPlan, 17,000 residential floor plans (data CC BY 4.0, code MIT)
https://github.com/m-agour/ResPlan — pinned by sha256 in
test-assets/plans/resplan/INDEX.json.

Usage (run with -I; the pickle is untrusted input):
    python3 -I scripts/resplan/convert_resplan.py \
        --pkl <dir>/ResPlan.pkl --split <dir>/split.json \
        --out test-assets/plans/resplan --per-bedroom-bucket 3

Pipeline per plan
  1. Scale: residential door leaves are ~0.85 m, so k = 0.85 / median door
     width. (ResPlan's area fields disagree with its own geometry on many
     plans; door width is the most stable physical anchor.)
  2. Walls: union wall + door + window polygons (openings are gaps in the
     wall strip), then pair opposite parallel edges to get centerlines
     with thickness. Quality = IoU between the re-buffered centerlines and
     the original strip; plans below MIN_WALL_IOU are rejected.
  3. Openings: each door/window rectangle is attached to the parallel wall
     segment that contains its center (offset along the wall + width).
  4. Rooms: ResPlan semantic polygons -> Solence RoomType.
Only plans passing every sanity check are written. Selection is
deterministic: test split, ascending id, N plans per bedroom bucket.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import pickle
import statistics
import sys
from typing import Any

from shapely.geometry import LineString, Point, Polygon
from shapely.ops import unary_union

ALLOWED_GLOBALS = {
    ("shapely.io", "from_wkb"),
    ("numpy._core.multiarray", "scalar"),
    ("numpy", "dtype"),
}


class SafeUnpickler(pickle.Unpickler):
    """Refuses every global except the three ResPlan actually uses."""

    def find_class(self, module: str, name: str) -> Any:
        if (module, name) not in ALLOWED_GLOBALS:
            raise pickle.UnpicklingError(f"blocked global {module}.{name}")
        return super().find_class(module, name)


ROOM_TYPES = {
    "bedroom": "bedroom",
    "bathroom": "bathroom",
    "kitchen": "kitchen",
    "living": "living",
    "inner": "hallway",
    "storage": "other",
    "stair": "other",
    "balcony": "outdoor",
}
ROOM_LABELS = {
    "bedroom": "Bedroom",
    "bathroom": "Bathroom",
    "kitchen": "Kitchen",
    "living": "Living",
    "inner": "Hall",
    "storage": "Storage",
    "stair": "Stair",
    "balcony": "Balcony",
}

DOOR_LEAF_M = 0.85
MARGIN_M = 0.5
MIN_WALL_IOU = 0.80
MIN_OPENING_MATCH = 0.90


def parts(geom: Any) -> list:
    if geom is None or geom.is_empty:
        return []
    return list(getattr(geom, "geoms", [geom]))


def rect_dims(poly: Polygon) -> tuple[float, float, tuple[float, float], tuple[float, float]]:
    """(long side, short side, center, unit vector along the long side)."""
    r = poly.minimum_rotated_rectangle
    c = list(r.exterior.coords)
    a = (c[1][0] - c[0][0], c[1][1] - c[0][1])
    b = (c[2][0] - c[1][0], c[2][1] - c[1][1])
    la, lb = math.hypot(*a), math.hypot(*b)
    long_v, long_l, short_l = (a, la, lb) if la >= lb else (b, lb, la)
    u = (long_v[0] / long_l, long_v[1] / long_l) if long_l else (1.0, 0.0)
    ctr = r.centroid
    return long_l, short_l, (ctr.x, ctr.y), u


def ring_edges(poly: Polygon) -> list[tuple[tuple[float, float], tuple[float, float]]]:
    out = []
    for ring in [poly.exterior, *poly.interiors]:
        pts = list(ring.coords)
        for i in range(len(pts) - 1):
            out.append((pts[i], pts[i + 1]))
    return out


def centerlines(strip: Any, t: float) -> list[tuple[tuple[float, float], tuple[float, float]]]:
    """Pair opposite, parallel edges ~t apart; the midline is a wall."""
    edges = []
    for poly in parts(strip):
        for e in ring_edges(poly.simplify(0.02)):
            (x1, y1), (x2, y2) = e
            length = math.hypot(x2 - x1, y2 - y1)
            if length >= 0.12:
                edges.append((x1, y1, x2, y2, length))
    segs = []
    for i, (ax1, ay1, ax2, ay2, al) in enumerate(edges):
        ux, uy = (ax2 - ax1) / al, (ay2 - ay1) / al
        nx, ny = -uy, ux
        for j in range(i + 1, len(edges)):
            bx1, by1, bx2, by2, bl = edges[j]
            vx, vy = (bx2 - bx1) / bl, (by2 - by1) / bl
            if abs(ux * vy - uy * vx) > 0.05 or ux * vx + uy * vy > -0.95:
                continue  # not anti-parallel
            d = (bx1 - ax1) * nx + (by1 - ay1) * ny
            if not (0.5 * t <= abs(d) <= 1.7 * t):
                continue
            # overlap of b's projection onto a's line
            s1 = (bx1 - ax1) * ux + (by1 - ay1) * uy
            s2 = (bx2 - ax1) * ux + (by2 - ay1) * uy
            lo, hi = max(0.0, min(s1, s2)), min(al, max(s1, s2))
            if hi - lo < 0.15:
                continue
            lo, hi = lo - t / 2, hi + t / 2  # reach into junctions
            ox, oy = ax1 + nx * d / 2, ay1 + ny * d / 2
            segs.append(((ox + ux * lo, oy + uy * lo), (ox + ux * hi, oy + uy * hi), abs(d)))
    return segs


def convert(plan: dict) -> dict | None:
    doors = parts(plan.get("door")) + parts(plan.get("front_door"))
    windows = parts(plan.get("window"))
    if len(doors) < 3:
        return None
    k = DOOR_LEAF_M / statistics.median(rect_dims(d)[0] for d in doors)

    everything = unary_union(
        [g for key in (*ROOM_TYPES, "wall", "door", "window", "front_door") for g in parts(plan.get(key))]
    )
    minx, miny, _, _ = everything.bounds

    def tf(geom: Any) -> Any:
        from shapely import affinity

        g = affinity.translate(geom, -minx, -miny)
        g = affinity.scale(g, k, k, origin=(0, 0))
        return affinity.translate(g, MARGIN_M, MARGIN_M)

    wall = tf(plan["wall"])
    doors_m = [tf(d) for d in doors]
    windows_m = [tf(w) for w in windows]
    t = float(plan["wall_depth"]) * k
    strip = unary_union([wall, *doors_m, *windows_m]).buffer(0.01).buffer(-0.01)

    raw = centerlines(strip, t)
    if len(raw) < 8:
        return None
    walls = []
    for idx, (a, b, thick) in enumerate(raw):
        walls.append({
            "id": f"w{idx + 1}",
            "start": {"x": round(a[0], 3), "y": round(a[1], 3)},
            "end": {"x": round(b[0], 3), "y": round(b[1], 3)},
            "thickness": round(min(max(thick, 0.08), 0.35), 3),
        })

    rebuilt = unary_union([
        LineString([(w["start"]["x"], w["start"]["y"]), (w["end"]["x"], w["end"]["y"])]).buffer(w["thickness"] / 2, cap_style=2)
        for w in walls
    ])
    iou = rebuilt.intersection(strip).area / rebuilt.union(strip).area

    # Openings -> wall segments
    openings, matched, total = [], 0, 0
    for kind, polys in (("door", doors_m), ("window", windows_m)):
        for poly in polys:
            total += 1
            width, _, (cx, cy), (ux, uy) = rect_dims(poly)
            best = None
            for w in walls:
                sx, sy = w["start"]["x"], w["start"]["y"]
                ex, ey = w["end"]["x"], w["end"]["y"]
                L = math.hypot(ex - sx, ey - sy)
                if L < width:
                    continue
                wx, wy = (ex - sx) / L, (ey - sy) / L
                if abs(wx * uy - wy * ux) > 0.2:
                    continue  # opening must run along the wall
                along = (cx - sx) * wx + (cy - sy) * wy
                perp = abs((cx - sx) * -wy + (cy - sy) * wx)
                if perp > max(w["thickness"], t) or along < 0 or along > L:
                    continue
                if best is None or perp < best[0]:
                    best = (perp, w, along, L)
            if best is None:
                continue
            _, w, along, L = best
            offset = min(max(along - width / 2, 0.0), L - width)
            matched += 1
            openings.append({
                "id": f"{kind[0]}{len(openings) + 1}",
                "wallId": w["id"],
                "offset": round(offset, 3),
                "width": round(min(width, 10.0), 3),
                "kind": kind,
            })
    match_rate = matched / total if total else 0.0

    rooms, counters = [], {}
    for key, rtype in ROOM_TYPES.items():
        for poly in parts(plan.get(key)):
            poly = tf(poly).simplify(0.02)
            if poly.area < 1.0 or not poly.is_valid:
                continue
            counters[key] = counters.get(key, 0) + 1
            pts = list(poly.exterior.coords)[:-1]
            rooms.append({
                "id": f"r-{key}-{counters[key]}",
                "name": f"{ROOM_LABELS[key]} {counters[key]}",
                "type": rtype,
                "boundary": [{"x": round(x, 3), "y": round(y, 3)} for x, y in pts],
            })

    _, _, maxx, maxy = tf(everything).bounds
    width_m, height_m = maxx + MARGIN_M, maxy + MARGIN_M
    checks = {
        "extent_ok": 5 <= width_m <= 30 and 5 <= height_m <= 30,
        "wall_thickness_ok": 0.10 <= t <= 0.30,
        "wall_iou_ok": iou >= MIN_WALL_IOU,
        "openings_ok": match_rate >= MIN_OPENING_MATCH,
        "has_core_rooms": all(counters.get(r, 0) >= 1 for r in ("bedroom", "bathroom", "kitchen")),
    }
    if not all(checks.values()):
        return None
    return {
        "floorPlan": {
            "width": round(width_m, 3),
            "height": round(height_m, 3),
            "ceilingHeight": 2.7,
            "walls": walls,
            "rooms": rooms,
            "openings": openings,
        },
        "meta": {
            "source": "ResPlan",
            "resplanId": int(plan["id"]),
            "metersPerUnit": round(k, 5),
            "wallThicknessM": round(t, 3),
            "wallIoU": round(iou, 4),
            "openingMatchRate": round(match_rate, 4),
            "doors": len(doors_m),
            "windows": len(windows_m),
            "rooms": counters,
        },
    }


def sha256(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--pkl", required=True)
    ap.add_argument("--split", required=True)
    ap.add_argument("--zip", help="ResPlan.zip, for the sha256 pin")
    ap.add_argument("--out", required=True)
    ap.add_argument("--per-bedroom-bucket", type=int, default=3)
    args = ap.parse_args()

    with open(args.pkl, "rb") as f:
        data = SafeUnpickler(f).load()
    test_ids = set(json.load(open(args.split))["test"])
    buckets: dict[str, list] = {"1": [], "2": [], "3": [], "4+": []}
    tried = rejected = 0
    for plan in sorted((p for p in data if p["id"] in test_ids), key=lambda p: p["id"]):
        if all(len(v) >= args.per_bedroom_bucket for v in buckets.values()):
            break
        beds = len(parts(plan.get("bedroom")))
        key = "4+" if beds >= 4 else str(beds)
        if key not in buckets or len(buckets[key]) >= args.per_bedroom_bucket:
            continue
        tried += 1
        out = convert(plan)
        if out is None:
            rejected += 1
            continue
        buckets[key].append(out)

    os.makedirs(args.out, exist_ok=True)
    index = {
        "source": "https://github.com/m-agour/ResPlan",
        "license": "CC BY 4.0 (data), MIT (code)",
        "attribution": "ResPlan: A Large-Scale Vector-Graph Dataset of 17,000 Residential Floor Plans (m-agour/ResPlan)",
        "sourceSha256": {
            "ResPlan.zip": sha256(args.zip) if args.zip else None,
            "split.json": sha256(args.split),
        },
        "converter": "scripts/resplan/convert_resplan.py",
        "selection": f"test split, ascending id, {args.per_bedroom_bucket} per bedroom bucket (1/2/3/4+), sanity checks pass",
        "tried": tried,
        "rejected": rejected,
        "plans": [],
    }
    for key, items in buckets.items():
        for item in items:
            rid = item["meta"]["resplanId"]
            name = f"resplan-{rid}.json"
            with open(os.path.join(args.out, name), "w") as f:
                json.dump(item, f, separators=(",", ":"))
            index["plans"].append({"file": name, "bedroomBucket": key, **item["meta"]})
    with open(os.path.join(args.out, "INDEX.json"), "w") as f:
        json.dump(index, f, indent=2)
    print(f"tried {tried}, rejected {rejected}, wrote {len(index['plans'])} plans")
    return 0 if len(index["plans"]) == 4 * args.per_bedroom_bucket else 1


if __name__ == "__main__":
    sys.exit(main())

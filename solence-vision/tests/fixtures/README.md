# Test fixtures

A **small** checked-in set of sample floor plan images the model tests
run against — a handful of images, not a dataset.

- Add 3–5 real (or realistic) floor plan images here as `.png`/`.jpg`.
  Prefer plans that look like actual PH submissions (hand-drawn or
  AutoCAD-style), since that's what the models must survive.
- Every image should contain at least one door and one window so
  `test_yolo_model.py` has something meaningful to assert.
- Keep files under ~500 KB each; git is not a dataset store.

The synthetic image used by the fusion/API tests is generated in
`conftest.py` and never touches this folder.

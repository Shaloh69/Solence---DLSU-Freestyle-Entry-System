# tests/

pytest suite (brief §8.3): fusion/pipeline/API-contract tests run with
no models (synthetic fixtures from conftest.py); the model regression
tests skip until trained weights exist and then become the
catch-a-silent-regression gate — run `pytest tests/` after every
retrain. Add a handful of real PH plans to `fixtures/` per its README.

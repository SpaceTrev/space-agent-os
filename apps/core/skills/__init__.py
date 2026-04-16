"""
skills/ — Reusable agent skills for Space-Agent-OS.

Each module is a self-contained skill that can be invoked:
  - As a CLI:   python -m apps.core.skills.<skill_name> <args>
  - As a lib:   from apps.core.skills.<skill_name> import run_*
  - Via API:    POST /ingest/youtube  (and other skill-specific endpoints)
"""

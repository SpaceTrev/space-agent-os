# apps/core/sync/config.py
"""Supabase client configuration for the sync layer."""

import os
import logging

from supabase import create_client, Client

logger = logging.getLogger("sync")

SUPABASE_URL: str = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY: str = os.environ.get("SUPABASE_SERVICE_KEY", "")

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    logger.warning(
        "SUPABASE_URL or SUPABASE_SERVICE_KEY not set – "
        "sync layer will fail at runtime."
    )

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

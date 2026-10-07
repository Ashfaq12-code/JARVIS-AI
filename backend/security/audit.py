from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from .permissions import PermissionLevel

AUDIT_LOG_PATH = Path(__file__).resolve().with_name("audit.log")


def log_action(
    action: str,
    target: str,
    permission_level: PermissionLevel | str = PermissionLevel.SAFE,
    confirmation_status: str = "not_required",
    result: str = "allowed",
    user: str = "system",
    details: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    entry = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "user": user,
        "action": (action or "").strip(),
        "target": (target or "").strip(),
        "permission_level": permission_level.value if isinstance(permission_level, PermissionLevel) else str(permission_level),
        "confirmation_status": confirmation_status,
        "result": result,
        "details": details or {},
    }

    with AUDIT_LOG_PATH.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(entry, ensure_ascii=True) + "\n")

    return entry


def get_audit_log(limit: int = 20) -> List[Dict[str, Any]]:
    if not AUDIT_LOG_PATH.exists():
        return []

    entries: List[Dict[str, Any]] = []
    with AUDIT_LOG_PATH.open("r", encoding="utf-8") as handle:
        for line in handle:
            if not line.strip():
                continue
            try:
                entries.append(json.loads(line))
            except json.JSONDecodeError:
                continue
            if len(entries) >= max(1, limit):
                break
    return entries

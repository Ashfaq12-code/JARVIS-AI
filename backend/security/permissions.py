from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, Optional, Set


class PermissionLevel(str, Enum):
    SAFE = "SAFE"
    CONFIRMATION_REQUIRED = "CONFIRMATION_REQUIRED"
    RESTRICTED = "RESTRICTED"


DEFAULT_PERMISSION_LEVEL = PermissionLevel.SAFE

CONFIRMATION_REQUIRED_ACTIONS: Set[str] = {
    "send_whatsapp_message",
    "create_file",
    "delete_file",
    "modify_file",
    "install_software",
    "run_command",
    "send_message",
    "open_external_link",
    "open_webpage",
    "whatsapp_message",
    "system_credential",
    "security_settings",
    "move_mouse",
    "click",
    "double_click",
    "right_click",
    "scroll",
    "type_text",
    "press_key",
    "focus_window",
}

RESTRICTED_ACTIONS: Set[str] = {
    "security_settings",
    "credentials",
    "financial_action",
    "destructive_system",
    "disable_security",
    "arbitrary_shell",
}


@dataclass
class PermissionDecision:
    action: str
    target: str
    required_level: PermissionLevel
    requires_confirmation: bool
    confirmed: bool = False
    allowed: bool = True
    message: str = ""
    prompt: Optional[Dict[str, str]] = field(default=None)

    def to_dict(self) -> Dict[str, object]:
        return {
            "action": self.action,
            "target": self.target,
            "required_level": self.required_level.value,
            "requires_confirmation": self.requires_confirmation,
            "confirmed": self.confirmed,
            "allowed": self.allowed,
            "message": self.message,
            "prompt": self.prompt,
        }


def get_permission_level(action: str) -> PermissionLevel:
    normalized = (action or "").strip().lower()
    if not normalized:
        return DEFAULT_PERMISSION_LEVEL
    if normalized in RESTRICTED_ACTIONS:
        return PermissionLevel.RESTRICTED
    if normalized in CONFIRMATION_REQUIRED_ACTIONS:
        return PermissionLevel.CONFIRMATION_REQUIRED
    return DEFAULT_PERMISSION_LEVEL


def build_confirmation_prompt(action: str, target: str) -> Dict[str, str]:
    return {
        "title": "JARVIS wants to:",
        "action": action,
        "target": target,
        "message": f"JARVIS wants to: {action}\nTarget: {target}\nButtons: [Allow Once] [Deny]",
    }


def confirm_action(action: str, target: str, approved: bool = False) -> bool:
    decision = check_permission(action, target, confirmed=approved)
    return decision.allowed


def check_permission(action: str, target: str = "", confirmed: bool = False) -> PermissionDecision:
    normalized = (action or "").strip().lower()
    permission_level = get_permission_level(normalized)
    requires_confirmation = permission_level == PermissionLevel.CONFIRMATION_REQUIRED
    prompt = None

    if permission_level == PermissionLevel.RESTRICTED:
        requires_confirmation = True
        prompt = build_confirmation_prompt(normalized, target)
        if not confirmed:
            return PermissionDecision(
                action=normalized,
                target=target,
                required_level=PermissionLevel.RESTRICTED,
                requires_confirmation=True,
                confirmed=False,
                allowed=False,
                message="Restricted action requires explicit approval.",
                prompt=prompt,
            )

    if requires_confirmation and not confirmed:
        prompt = build_confirmation_prompt(normalized, target)
        return PermissionDecision(
            action=normalized,
            target=target,
            required_level=permission_level,
            requires_confirmation=True,
            confirmed=False,
            allowed=False,
            message="Confirmation required before this action can execute.",
            prompt=prompt,
        )

    return PermissionDecision(
        action=normalized,
        target=target,
        required_level=permission_level,
        requires_confirmation=requires_confirmation,
        confirmed=confirmed,
        allowed=True,
        message="Action permitted under current security policy.",
        prompt=prompt,
    )

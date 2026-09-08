"""Config-schema v2 (PTTA §3): load, validate, coerce, redact, migrate.

Contract: `validate_config` NEVER partially applies. Either the whole payload
is accepted (returning the merged, coerced config) or a field-keyed error dict
is returned for the form to render inline. Plugins without a schema keep the
legacy pass-through behaviour in PUT /plugins/<slug>/config.

Dialect (18 types), visibility (`visible_when` composites), per-role filtering,
secret redaction and the `config_version` migration runner are specified in
audits/research/PLUGIN_THEME_TEMPLATE_ARCHITECTURE.md §3.2–§3.7.
"""
from __future__ import annotations

import copy
import hashlib
import logging
import re
from dataclasses import dataclass, field as dc_field
from datetime import date, datetime

from app.plugins.config_store import get_dotted, get_plugin_config

logger = logging.getLogger(__name__)

SUPPORTED_TYPES = {
    "string", "text", "int", "number", "boolean", "enum", "multi-enum", "color",
    "color-map", "file", "secret", "cron", "time", "date", "bs_date", "json",
    "entity-picker", "list", "markdown",
}

_HEX = re.compile(r"^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$")
_CRON = re.compile(r"^(\S+\s+){4}\S+$")
_SAFE_COLOR_WORDS = {
    "black", "white", "red", "green", "blue", "yellow", "orange", "purple",
    "gray", "grey", "transparent",
}
_FORMATS = {
    "email": re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$"),
    "url": re.compile(r"^https?://\S+$"),
    "slug": re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$"),
    "phone": re.compile(r"^\+?[0-9\s-]{7,15}$"),
}
_BS_DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
_TIME = re.compile(r"^\d{2}:\d{2}(?::\d{2})?$")


class FieldError(Exception):
    def __init__(self, key: str, message: str):
        super().__init__(message)
        self.key = key
        self.message = message


@dataclass
class Schema:
    version: int
    config_version: int
    groups: list[dict] = dc_field(default_factory=list)
    fields: list[dict] = dc_field(default_factory=list)

    def by_key(self) -> dict[str, dict]:
        return {f["key"]: f for f in self.fields}


# ── loading ────────────────────────────────────────────────────────────────

def _upgrade_v1_schema(raw: dict) -> dict:
    """v1 = a flat `fields` list with 4 types; v2 wraps it with a version.

    Old types map: number→number, boolean→boolean, json→json, else→string.
    `min`/`max` hints move under `validate` so v1 schemas keep validating.
    """
    fields = []
    for f in raw.get("fields") or []:
        if not isinstance(f, dict):
            continue
        out = dict(f)
        if out.get("type") not in SUPPORTED_TYPES:
            out["type"] = "string"
        validate = dict(out.get("validate") or {})
        for legacy in ("min", "max"):
            if legacy in out and legacy not in validate:
                validate[legacy] = out.pop(legacy)
        if validate:
            out["validate"] = validate
        fields.append(out)
    return {
        "schema_version": 2,
        "config_version": int(raw.get("config_version") or 1),
        "groups": raw.get("groups") or [],
        "fields": fields,
    }


def load_schema(slug: str) -> Schema | None:
    """Parse + structurally validate a plugin's config_schema.yaml (cached).

    Raises ValueError on structural defects — the validator turns that into a
    plugin-contract error, and the settings API answers 500-free by falling
    back to the legacy editor.
    """
    from app.plugins.loader import PluginLoader

    raw = PluginLoader.get_config_schema_raw(slug)  # {} when absent
    if not raw:
        return None
    if int(raw.get("schema_version") or 1) < 2:
        raw = _upgrade_v1_schema(raw)
    fields = raw.get("fields") or []
    seen: set[str] = set()
    for f in fields:
        key, ftype = f.get("key"), f.get("type", "string")
        if not key or ftype not in SUPPORTED_TYPES:
            raise ValueError(f"{slug}: bad field {key!r} type {ftype!r}")
        if key in seen:
            raise ValueError(f"{slug}: duplicate field key {key!r}")
        seen.add(key)
        if ftype in ("enum", "multi-enum") and not f.get("options"):
            raise ValueError(f"{slug}: {key} needs options")
        if ftype == "entity-picker" and not f.get("entity"):
            raise ValueError(f"{slug}: {key} needs entity")
        if ftype == "list" and not f.get("item_fields"):
            raise ValueError(f"{slug}: {key} needs item_fields")
    return Schema(
        version=2,
        config_version=int(raw.get("config_version") or 1),
        groups=raw.get("groups") or [],
        fields=fields,
    )


# ── visibility ─────────────────────────────────────────────────────────────

def _num(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def _cond_met(cond: dict, values: dict) -> bool:
    if "all_of" in cond:
        return all(_cond_met(c, values) for c in cond["all_of"])
    if "any_of" in cond:
        return any(_cond_met(c, values) for c in cond["any_of"])
    actual = get_dotted(values, cond.get("field", ""))
    if "eq" in cond:
        return actual == cond["eq"]
    if "ne" in cond:
        return actual != cond["ne"]
    if "truthy" in cond:
        return bool(actual) is bool(cond["truthy"])
    if "gt" in cond:
        return _num(actual) > _num(cond["gt"])
    if "lt" in cond:
        return _num(actual) < _num(cond["lt"])
    if "in" in cond:
        wanted = cond["in"] or []
        if isinstance(actual, list):
            return bool(set(actual) & set(wanted))
        return actual in wanted
    return True


def visible_fields(
    schema: Schema, values: dict, role: str, installed: set[str] | None = None
) -> list[dict]:
    """Fields the caller may see/write, evaluated against the MERGED values."""
    installed = installed if installed is not None else set()
    groups = {g.get("key"): g for g in schema.groups}
    out = []
    for f in schema.fields:
        grp = groups.get(f.get("group") or "", {})
        if f.get("roles") and role not in f["roles"]:
            continue
        if grp.get("roles") and role not in grp["roles"]:
            continue
        if any(p not in installed for p in (f.get("requires_plugins") or [])):
            continue
        if f.get("visible_when") and not _cond_met(f["visible_when"], values):
            continue
        out.append(f)
    return out


# ── secrets ────────────────────────────────────────────────────────────────
# itsdangerous is signed (tamper-proof) rather than reversible-encrypted;
# swapping in Fernet later is a one-function change plus a key rotation
# because every secret already carries its envelope version.

def _secret_signer():
    import os

    from itsdangerous.url_safe import URLSafeSerializer

    from flask import current_app

    try:
        base = current_app.config.get("SECRET_CONFIG_KEY") or current_app.config.get(
            "SECRET_KEY", "change-me"
        )
    except RuntimeError:  # outside app context (tests/CLI)
        base = os.getenv("SECRET_CONFIG_KEY") or os.getenv("SECRET_KEY", "change-me")
    key = hashlib.sha256(f"aschool-config-secret:{base}".encode()).digest()
    return URLSafeSerializer(key)


def encrypt_secret(plaintext: str) -> dict:
    """Envelope stored in SchoolPlugin.config — plaintext never lands in JSONB."""
    token = _secret_signer().dumps({"v": 1, "s": plaintext})
    return {
        "__secret__": True,
        "cipher": token,
        "last4": plaintext[-4:] if len(plaintext) >= 4 else "••••",
    }


def decrypt_secret(envelope: dict) -> str | None:
    if not isinstance(envelope, dict) or not envelope.get("__secret__"):
        return None
    try:
        return _secret_signer().loads(envelope["cipher"])["s"]
    except Exception:  # noqa: BLE001 — a rotated key must not 500 a read
        return None


def _redact_secret_envelopes(node):
    """Redact ANY `__secret__` envelope found at any depth — including keys a
    plugin's schema does not declare (e.g. ai_teacher's provisioned
    webhook_secret). Defense against schema-drift secret leakage (F2)."""
    if isinstance(node, dict):
        for k, v in list(node.items()):
            if isinstance(v, dict) and v.get("__secret__"):
                node[k] = {"__secret__": True, "last4": v.get("last4", "••••")}
            else:
                _redact_secret_envelopes(v)
    elif isinstance(node, list):
        for item in node:
            _redact_secret_envelopes(item)


def redact_config(schema: Schema | None, config: dict, role: str) -> dict:
    """GET /config view: never echo a secret, only its last4 marker."""
    out = copy.deepcopy(config or {})
    # Envelope sweep first — schema-declared or not, a secret envelope is a
    # secret (F24: ai_teacher webhook_secret is not a schema field).
    _redact_secret_envelopes(out)
    if not schema:
        return out
    for f in schema.fields:
        if f.get("type") != "secret":
            continue
        node = out
        parts = f["key"].split(".")
        for part in parts[:-1]:
            if not isinstance(node.get(part), dict):
                node = None
                break
            node = node[part]
        if isinstance(node, dict) and parts[-1] in node:
            envelope = node[parts[-1]]
            if isinstance(envelope, dict) and envelope.get("__secret__"):
                node[parts[-1]] = {
                    "__secret__": True,
                    "last4": envelope.get("last4", "••••"),
                }
    return out


# ── entity-picker ──────────────────────────────────────────────────────────

def entity_exists_for_school(
    entity: str, value, school_id, entity_filter: dict | None = None
) -> bool:
    """Resolve a selection inside the caller's school — blocks cross-tenant ids."""
    if value is None or value == "":
        return True  # clearing is always legal
    from uuid import UUID as _UUID

    try:
        uid = _UUID(str(value))
    except (TypeError, ValueError, AttributeError):
        return False

    from app.models.academic import Class, Section, Subject
    from app.models.student import Student
    from app.models.user import User
    from extensions import db

    model, extra = {
        "student": (Student, {}),
        "teacher": (User, {"role": "teacher"}),
        "user": (User, {}),
        "class": (Class, {}),
        "section": (Section, {}),
        "subject": (Subject, {}),
    }.get(entity, (None, None))
    if model is None:
        return False
    q = model.query.filter_by(id=uid, school_id=school_id, is_deleted=False)
    for k, v in {**(extra or {}), **(entity_filter or {})}.items():
        q = q.filter(getattr(model, k) == v)
    try:
        return db.session.query(q.exists()).scalar()
    except Exception:  # noqa: BLE001 — unknown column in entity_filter
        logger.warning("entity-picker filter failed for %s", entity, exc_info=True)
        return False


def _validate_file_ref(key: str, f: dict, value) -> dict:
    from app.models.file import ManagedFile
    from flask import g as flask_g

    if not isinstance(value, dict) or not value.get("id"):
        raise FieldError(key, "must be a file reference {id, url, name, size}")
    try:
        from uuid import UUID as _UUID

        fid = _UUID(str(value["id"]))
    except (TypeError, ValueError, AttributeError):
        raise FieldError(key, "file id is not valid")
    school_id = getattr(flask_g, "school_id", None)
    mf = ManagedFile.query.filter_by(
        id=fid, school_id=school_id, is_deleted=False
    ).first() if school_id else None
    if not mf:
        raise FieldError(key, "file not found in this school")
    accept = f.get("accept") or []
    if accept:
        mime = (mf.mime_type or "").lower()
        if not any(
            mime.startswith(a.rstrip("/*").lower()) or mime == a.lower()
            for a in accept
        ):
            raise FieldError(key, f"file type {mime or 'unknown'} not accepted")
    max_mb = f.get("max_size_mb")
    if max_mb and (mf.size_bytes or 0) > int(max_mb) * 1024 * 1024:
        raise FieldError(key, f"file exceeds {max_mb} MB")
    return {"id": str(mf.id), "url": value.get("url"), "name": value.get("name"),
            "size": value.get("size")}


# ── coercion ───────────────────────────────────────────────────────────────

def _coerce(f: dict, value, ctx: dict | None = None):
    t, key = f.get("type", "string"), f["key"]
    v = f.get("validate") or {}
    if value is None and f.get("type") != "secret":
        if f.get("default") is not None:
            return f["default"]
        return None
    if t == "boolean":
        if not isinstance(value, bool):
            raise FieldError(key, "must be true or false")
        return value
    if t in ("int", "number"):
        try:
            num = int(value) if t == "int" else float(value)
        except (TypeError, ValueError):
            raise FieldError(key, "must be a number")
        if "min" in v and num < v["min"]:
            raise FieldError(key, f"must be ≥ {v['min']}")
        if "max" in v and num > v["max"]:
            raise FieldError(key, f"must be ≤ {v['max']}")
        return num
    if t in ("string", "text", "markdown"):
        s = "" if value is None else str(value)
        if "min_length" in v and len(s) < v["min_length"]:
            raise FieldError(key, "too short")
        if "max_length" in v and len(s) > v["max_length"]:
            raise FieldError(key, "too long")
        if v.get("pattern") and not re.match(v["pattern"], s):
            raise FieldError(key, "invalid format")
        fmt = f.get("format")
        if fmt and fmt in _FORMATS and not _FORMATS[fmt].match(s):
            raise FieldError(key, f"invalid {fmt}")
        return s
    if t == "enum":
        allowed = {o.get("value") for o in f.get("options") or []}
        if value not in allowed:
            raise FieldError(key, "not an allowed option")
        return value
    if t == "multi-enum":
        allowed = {o.get("value") for o in f.get("options") or []}
        if not isinstance(value, list) or not set(value) <= allowed:
            raise FieldError(key, "contains an unknown option")
        if len(value) < (v.get("min_items") or 0):
            raise FieldError(key, "select at least one")
        if "max_items" in v and len(value) > v["max_items"]:
            raise FieldError(key, "too many selected")
        return value
    if t == "color":
        if not _HEX.match(str(value or "")) and str(value).lower() not in _SAFE_COLOR_WORDS:
            raise FieldError(key, "must be a hex colour like #2563EB")
        return value
    if t == "color-map":
        if not isinstance(value, dict) or not set(value) <= set(f.get("keys") or []):
            raise FieldError(key, "unexpected colour keys")
        for k, c in value.items():
            if not _HEX.match(str(c or "")):
                raise FieldError(f"{key}.{k}", "must be a hex colour")
        return value
    if t == "cron":
        if not _CRON.match(str(value or "")):
            raise FieldError(key, "must be a 5-field cron expression")
        return value
    if t == "time":
        s = str(value or "")
        if not _TIME.match(s):
            raise FieldError(key, "must be HH:MM")
        hh, mm, *_rest = (int(p) for p in s.split(":"))
        if hh > 23 or mm > 59 or (_rest and _rest[0] > 59):
            raise FieldError(key, "must be a valid time (HH:MM)")
        return value
    if t == "date":
        try:
            datetime.strptime(str(value), "%Y-%m-%d")
        except (TypeError, ValueError):
            raise FieldError(key, "must be YYYY-MM-DD")
        return value
    if t == "bs_date":
        if not _BS_DATE.match(str(value or "")):
            raise FieldError(key, "must be a BS date like 2082-04-01")
        return value
    if t == "entity-picker":
        if not entity_exists_for_school(
            f["entity"], value, (ctx or {}).get("school_id"), f.get("entity_filter")
        ):
            raise FieldError(key, "unknown selection")
        return value
    if t == "file":
        return _validate_file_ref(key, f, value)
    if t == "list":
        if not isinstance(value, list):
            raise FieldError(key, "must be a list")
        if len(value) < (v.get("min_items") or 0):
            raise FieldError(key, "too few items")
        if "max_items" in v and len(value) > v["max_items"]:
            raise FieldError(key, "too many items")
        sub = Schema(2, 1, [], f["item_fields"])
        out = []
        for item in value:
            errs, merged = validate_config(sub, item or {}, role="__item__", ctx=ctx)
            if errs:
                first = next(iter(errs))
                raise FieldError(key, f"item {len(out) + 1}: {first}: {errs[first]}")
            out.append(merged)
        return out
    if t == "json":
        if f.get("json_schema"):
            required = f["json_schema"].get("required") or []
            missing = [r for r in required if not (isinstance(value, dict) and r in value)]
            if missing:
                raise FieldError(key, f"missing keys: {', '.join(missing)}")
        return value
    if t == "secret":
        # An untouched field round-trips its envelope (full-dict saves); only
        # a typed plaintext string re-encrypts.
        if isinstance(value, dict) and value.get("__secret__"):
            return value
        if not isinstance(value, str) or not value:
            raise FieldError(key, "must be a non-empty string")
        return encrypt_secret(value)
    return value


# ── dotted helpers ─────────────────────────────────────────────────────────

def _flatten(d, prefix=""):
    out = {}
    for k, v in (d or {}).items():
        path = f"{prefix}.{k}" if prefix else k
        if isinstance(v, dict):
            out.update(_flatten(v, path))
        else:
            out[path] = v
    return out


def _set_dotted(d: dict, dotted: str, value):
    parts = dotted.split(".")
    node = d
    for part in parts[:-1]:
        node = node.setdefault(part, {})
        if not isinstance(node, dict):
            raise FieldError(dotted, "conflicts with a scalar value")
    node[parts[-1]] = value


def _unset_dotted(d: dict, dotted: str):
    parts = dotted.split(".")
    node = d
    for part in parts[:-1]:
        if not isinstance(node.get(part), dict):
            return
        node = node[part]
    node.pop(parts[-1], None)


def _deep_merge_into(base: dict, override: dict):
    for k, v in override.items():
        if isinstance(v, dict) and isinstance(base.get(k), dict):
            _deep_merge_into(base[k], v)
        else:
            base[k] = v


# ── validation ─────────────────────────────────────────────────────────────

def validate_config(
    schema: Schema,
    payload: dict,
    role: str = "school_admin",
    installed: set[str] | None = None,
    stored: dict | None = None,
    ctx: dict | None = None,
) -> tuple[dict, dict]:
    """Return (errors_by_key, merged_config). Errors non-empty ⇒ nothing applied."""
    merged = copy.deepcopy(stored or {})
    _deep_merge_into(merged, payload or {})  # visible_when sees NEW values
    allowed = {
        f["key"]: f
        for f in visible_fields(schema, merged, role, installed)
    }
    errors: dict[str, str] = {}
    result = copy.deepcopy(stored or {})
    known = schema.by_key()

    for key, value in _flatten(payload or {}).items():
        f = allowed.get(key)
        if f is None:
            errors[key] = (
                "not editable in this context" if key in known else "unknown setting"
            )
            continue
        if f.get("readonly"):
            errors[key] = "read-only"
            continue
        if f.get("type") == "secret" and value is None:
            _set_dotted(result, key, None)  # explicit clear
            continue
        try:
            _set_dotted(result, key, _coerce(f, value, ctx))
        except FieldError as exc:
            errors[exc.key] = exc.message

    # Hidden fields are pruned, not validated — an off feature never blocks a save.
    for key in list(_flatten(result)):
        if key in known and key not in allowed:
            _unset_dotted(result, key)

    result["__config_version__"] = schema.config_version
    return errors, result


# ── migrations (PTTA §3.6) ────────────────────────────────────────────────

def _plugin_migrations(slug: str) -> dict:
    from importlib import import_module

    try:
        mod = import_module(f"app.plugins.modules.{slug}.config_migrations")
        return dict(getattr(mod, "MIGRATIONS", {}))
    except ImportError:
        return {}


def _snapshot_config(slug: str, school_id, config: dict, action: str):
    """Pre-migration snapshot — a bad transform is recoverable from the log."""
    try:
        from flask import has_app_context

        if not has_app_context():
            return
        from app.models.compliance import AuditLog

        entry = AuditLog(
            school_id=school_id,
            action=f"plugin_config_{action}",
            entity_type="plugin_config",
            entity_id=slug,
            details={"config": config},
        )
        from extensions import db

        db.session.add(entry)
    except Exception:  # noqa: BLE001 — snapshot must never break a read
        logger.warning("config snapshot failed for %s", slug, exc_info=True)


def ensure_config_version(slug: str, school_id, stored: dict | None = None) -> dict:
    """Lazily migrate stored config to the schema's current config_version."""
    from extensions import db

    try:
        schema = load_schema(slug)
    except ValueError:
        return stored or {}
    if not schema:
        return stored or {}
    cfg = copy.deepcopy(stored) if stored is not None else get_plugin_config(
        school_id, slug
    )
    cfg = cfg if isinstance(cfg, dict) else {}
    current = int(cfg.get("__config_version__") or 1)
    if current >= schema.config_version:
        return cfg
    migrations = _plugin_migrations(slug)
    if schema.config_version > 1 and not migrations:
        logger.warning(
            "plugin %s declares config_version=%s but ships no config_migrations",
            slug,
            schema.config_version,
        )
        return cfg
    _snapshot_config(slug, school_id, cfg, "pre_migration")
    for version in range(current + 1, schema.config_version + 1):
        step = migrations.get(version)
        if step is None:
            logger.error(
                "plugin %s: missing config migration step for version %s",
                slug,
                version,
            )
            return cfg  # never half-migrate
        try:
            cfg = step(cfg) or cfg
        except Exception:  # noqa: BLE001 — a broken transform must not 500
            logger.exception("config migration %s→%s failed", slug, version)
            return cfg
    cfg["__config_version__"] = schema.config_version
    return cfg


# ── resolution ─────────────────────────────────────────────────────────────

_MISSING = object()


def resolve_config(
    slug: str, school_id, role: str = "school_admin", installed: set[str] | None = None
) -> dict:
    """Effective config = schema defaults ← stored values (what consumers read).

    Kills the defaults-duplication rule: consumers call this (or
    `plugin_config_value`, which delegates) instead of hardcoding fallbacks.
    """
    try:
        schema = load_schema(slug)
    except ValueError:
        schema = None
    stored = ensure_config_version(slug, school_id)
    stored = stored if isinstance(stored, dict) else {}
    if not schema:
        return stored
    out: dict = {}
    for f in visible_fields(schema, stored, role, installed):
        val = get_dotted(stored, f["key"], _MISSING)
        _set_dotted(
            out, f["key"], f.get("default") if val is _MISSING else val
        )
    merged = copy.deepcopy(stored)
    _deep_merge_into(merged, out)  # unknown keys preserved
    return merged


def schema_for_role(schema: Schema, role: str, installed: set[str] | None = None) -> dict:
    """API view of the schema with fields/groups filtered for the caller."""
    fields = visible_fields(schema, {}, role, installed)
    allowed_keys = {f["key"] for f in fields}
    groups = [
        g
        for g in schema.groups
        if not g.get("roles") or role in g["roles"]
    ]
    return {
        "schema_version": schema.version,
        "config_version": schema.config_version,
        "groups": groups,
        "fields": [f for f in fields if f["key"] in allowed_keys],
    }

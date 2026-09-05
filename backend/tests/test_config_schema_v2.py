"""Config-schema v2 tests (PTTA §3): validation contract, secrets, visibility.

Contract under test: validate_config NEVER partially applies; secrets never
echo; hidden fields prune instead of erroring; v1 schemas upgrade in memory;
the migration runner is lazy + snapshotted + never half-migrates.
"""
import pytest

from app.plugins import config_schema as cs


def _schema(**field_overrides):
    fields = [
        {"key": "provider", "type": "enum", "default": "sms",
         "options": [{"value": "sms", "label": "SMS"}, {"value": "push", "label": "Push"}]},
        {"key": "api_key", "type": "secret"},
        {"key": "retries", "type": "int", "default": 3,
         "validate": {"min": 0, "max": 10}},
        {"key": "send_hours", "type": "string",
         "visible_when": {"field": "provider", "eq": "sms"}},
        {"key": "channels", "type": "multi-enum",
         "options": [{"value": "sms", "label": "S"}, {"value": "push", "label": "P"},
                     {"value": "email", "label": "E"}]},
        {"key": "brand", "type": "color"},
        {"key": "reminder_cron", "type": "cron"},
        {"key": "quiet_hours", "type": "time"},
    ]
    for f in fields:
        f.update(field_overrides.get(f["key"], {}))
    return cs.Schema(2, 2, [], fields)


def test_validation_never_partially_applies():
    schema = _schema()
    errs, merged = cs.validate_config(
        schema,
        {"retries": 99, "provider": "push"},  # retries bad, provider good
        stored={"retries": 1},
    )
    assert errs == {"retries": "must be ≤ 10"}
    assert merged["retries"] == 1  # stored value untouched


def test_secret_is_enveloped_and_never_echoed():
    schema = _schema()
    errs, merged = cs.validate_config(
        schema, {"api_key": "sk-live-abcdef123456"}, stored={}
    )
    assert not errs
    envelope = merged["api_key"]
    assert envelope["__secret__"] is True
    assert envelope["last4"] == "3456"
    assert "sk-live" not in str(envelope)

    redacted = cs.redact_config(schema, merged, "school_admin")
    assert redacted["api_key"] == {"__secret__": True, "last4": "3456"}

    # Explicit None clears the secret.
    errs, merged = cs.validate_config(schema, {"api_key": None}, stored=merged)
    assert not errs and merged["api_key"] is None


def test_visible_when_prunes_hidden_fields():
    schema = _schema()
    # send_hours is hidden when provider != sms — writing it errors, storing
    # it (as a stale value) is silently pruned.
    errs, merged = cs.validate_config(
        schema, {"provider": "push", "send_hours": "08:00"}, stored={}
    )
    assert errs == {"send_hours": "not editable in this context"}
    errs, merged = cs.validate_config(
        schema, {"provider": "push"}, stored={"provider": "sms", "send_hours": "08:00"}
    )
    assert not errs
    assert "send_hours" not in merged


def test_type_coercion_contract():
    schema = _schema()
    errs, merged = cs.validate_config(
        schema,
        {
            "channels": ["sms", "nope"],
            "brand": "not-a-color",
            "reminder_cron": "* * * *",  # 4 fields
            "quiet_hours": "25:99",
        },
        stored={"provider": "sms"},
    )
    assert errs["channels"] == "contains an unknown option"
    assert "colour" in errs["brand"]
    assert errs["reminder_cron"] == "must be a 5-field cron expression"
    assert errs["quiet_hours"] == "must be a valid time (HH:MM)"

    errs, merged = cs.validate_config(
        schema,
        {"channels": ["sms", "push"], "brand": "#2563EB",
         "reminder_cron": "0 8 * * *", "quiet_hours": "22:00"},
        stored={"provider": "sms"},
    )
    assert not errs, errs


def test_v1_schema_upgrades_in_memory():
    v1 = {
        "fields": [
            {"key": "max_sms", "type": "number", "default": 100, "min": 1},
            {"key": "enabled", "type": "boolean", "default": True},
        ]
    }
    upgraded = cs._upgrade_v1_schema(v1)
    assert upgraded["schema_version"] == 2
    assert upgraded["fields"][0]["validate"]["min"] == 1
    schema = cs.Schema(
        2, 1, [], upgraded["fields"]
    )
    errs, merged = cs.validate_config(schema, {"max_sms": 0}, stored={})
    assert errs == {"max_sms": "must be ≥ 1"}


def test_role_and_group_filtering():
    fields = [
        {"key": "public_note", "type": "string"},
        {"key": "admin_key", "type": "secret", "roles": ["school_admin"]},
    ]
    schema = cs.Schema(2, 1, [{"key": "adv", "roles": ["school_admin"]}], fields)
    teacher_visible = {f["key"] for f in cs.visible_fields(schema, {}, "teacher")}
    assert "public_note" in teacher_visible and "admin_key" not in teacher_visible


def test_ensure_config_version_never_half_migrates(monkeypatch):
    from app.plugins import config_schema as mod

    monkeypatch.setattr(mod, "load_schema", lambda slug: mod.Schema(2, 3, [], []))
    calls = []

    def step2(cfg):
        calls.append(2)
        return {**cfg, "v2": True}

    monkeypatch.setattr(mod, "_plugin_migrations", lambda slug: {2: step2})  # 3 missing

    cfg = mod.ensure_config_version("whatever", "school-1", {"__config_version__": 1, "x": 1})
    # step 2 ran but step 3 is missing → nothing marked migrated
    assert calls == [2]
    assert "__config_version__" not in cfg or cfg["__config_version__"] != 3


def test_resolve_config_applies_defaults(monkeypatch):
    from app.plugins import config_schema as mod

    schema = mod.Schema(2, 1, [], [
        {"key": "retries", "type": "int", "default": 5},
        {"key": "label", "type": "string", "default": "Hello"},
    ])
    monkeypatch.setattr(mod, "load_schema", lambda slug: schema)
    monkeypatch.setattr(
        mod, "ensure_config_version", lambda slug, sid, stored=None: {"retries": 7}
    )
    out = mod.resolve_config("whatever", "school-1")
    assert out["retries"] == 7  # stored wins
    assert out["label"] == "Hello"  # default applied at read time

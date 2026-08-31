"""Deterministic default-password generation for ASchool logins.

Default credentials are built ONLY from fields every user record is
guaranteed to carry — NEVER from the school's EMIS/regd number. Students
can be added manually or via IEMIS import, so EMIS data cannot be trusted
to exist for everyone.

Scheme (configurable per school via the User Management plugin, slug
``users`` — backend/app/plugins/manifests/users.yaml):

    role           default pattern                   example
    ────────────   ───────────────────────────────   ────────────
    student        {class}{section}{roll}.{first}    7a12.ram
    parent         p{roll}.{first}{last4}            p12.ram4821
    staff/other    {first}.{last4}                   sita.4821

Config keys (SchoolPlugin.config of plugin slug ``users``, read via
app.plugins.config_store.plugin_config_value):

    credentials.student_pattern   → student pattern override
    credentials.parent_pattern    → parent pattern override
    credentials.staff_pattern     → staff / other-role pattern override

Token reference
    {class}        slugified class name         "Grade 10" → "grade10"
    {section}      slugified section name       "A" → "a"
    {roll}         class roll number            12 → "12"
    {first}        slugified first name         "Ram Bahadur" → "ram"
    {last}         slugified last name          "Sharma" → "sharma"
    {firstinitial} first letter of {first}      "ram" → "r"
    {last4}        last 4 characters of the login phone (user.phone; for
                   students/parents it falls back to the primary
                   guardian's phone, then to "")
    {seq}          collision counter (1, 2, 3 …). When the pattern
                   contains {seq} the counter is rendered in-place;
                   otherwise a "-2"/"-3" suffix is appended to repeated
                   candidates.

Rules
    - Output is short, lowercase ASCII, deterministic and space-free.
    - Names are slugified (unicodedata NFKD fold, non-alnum stripped);
      an empty slug falls back to the token "user".
    - Students without a roll number, parents without a linked child and
      users without a phone degrade gracefully to the {first}.{last4}
      scheme (ultimately "user" + collision suffix). Generation NEVER raises.
    - Parent credentials are derived from the child's identity: the child
      is the explicitly passed ``student``, else the user's own student
      profile (student users), else the first linked child via the
      Guardian rows (parent users).
    - Collision-safe: the base credential is uniquified while another
      active user in the same school would derive the identical
      credential. Pass ``taken`` (a set) to resolve collisions purely in
      memory — bulk imports should share one set to avoid per-row DB
      queries:

          taken: set[str] = set()
          for row in rows:
              pw = generate_default_password(u, s, school, taken=taken)

      Without ``taken`` a best-effort DB check runs (users has no username
      column and email/phone carry no unique constraint, so the check
      re-derives the credential for the few same-school users that could
      collide). The default student pattern with class+section+roll all
      present is inherently unique — class rolls are unique per
      class/section — so it skips the DB check entirely.

Signature is stable: generate_default_password(user, student=None,
school=None, taken=None) — every existing call site keeps working.
"""

from __future__ import annotations

import re
import unicodedata

# User Management plugin (backend/app/plugins/manifests/users.yaml)
PLUGIN_SLUG = "users"

DEFAULT_PATTERNS = {
    "student": "{class}{section}{roll}.{first}",
    "parent": "p{roll}.{first}{last4}",
    "staff": "{first}.{last4}",
}

_CONFIG_KEYS = {
    "student": "credentials.student_pattern",
    "parent": "credentials.parent_pattern",
    "staff": "credentials.staff_pattern",
}

_TOKEN_RE = re.compile(r"\{(class|section|roll|first|last|firstinitial|last4|seq)\}")

_MAX_ATTEMPTS = 1000


# ── small pure helpers ────────────────────────────────────────────────────────


def _slug(value, max_len: int = 24) -> str:
    """ASCII-lowercase slug: NFKD-fold, keep [a-z0-9] only."""
    if not value:
        return ""
    folded = unicodedata.normalize("NFKD", str(value))
    out = "".join(ch for ch in folded if ch.isascii() and ch.isalnum()).lower()
    return out[:max_len]


def _first_token(full_name) -> str:
    """First whitespace-separated token of a full name."""
    text = str(full_name or "").strip()
    return text.split()[0] if text else ""


def _last4(*phones) -> str:
    """Last 4 characters of the first phone that yields any; '' when none."""
    for phone in phones:
        if not phone:
            continue
        text = _slug(phone)
        if text:
            return text[-4:]
    return ""


def _role_of(user) -> str:
    role = str(getattr(user, "role", "") or "")
    if role == "parent":
        return "parent"
    if role == "student":
        return "student"
    return "staff"


def _student_of(user, student):
    """Explicit student arg, else the user's own student profile."""
    if student is not None:
        return student
    profiles = getattr(user, "student_profile", None) or []
    return profiles[0] if profiles else None


def _child_of(user):
    """First linked child of a parent user (primary guardian first)."""
    links = getattr(user, "guardian_profile", None) or []

    def _order(link):
        primary = bool(getattr(link, "is_primary", False))
        return (not primary, str(getattr(link, "id", "") or ""))

    for link in sorted(links, key=_order):
        child = getattr(link, "student", None)
        if child is not None:
            return child
    return None


def _guardian_phone(student) -> str:
    """Primary guardian's phone for a student row ('' when unavailable)."""
    for guardian in getattr(student, "guardians", None) or []:
        phone = getattr(guardian, "phone", None)
        if phone:
            return phone
    return ""


def _validate_pattern(pattern) -> str:
    """Return the pattern when it is a usable string, else ''."""
    if not isinstance(pattern, str) or not pattern.strip():
        return ""
    pattern = pattern.strip()[:100]
    residue = _TOKEN_RE.sub("", pattern)
    if "{" in residue or "}" in residue:  # unknown/garbage tokens
        return ""
    return pattern


def _patterns_for(school_id) -> dict:
    """(student, parent, staff) patterns for a school — plugin-config
    override or the built-in defaults. Best-effort; memoized per request."""
    patterns = dict(DEFAULT_PATTERNS)
    if not school_id:
        return patterns
    try:
        from flask import g, has_app_context

        if not has_app_context():
            return patterns
        cache = getattr(g, "_default_password_patterns", None)
        if cache is None:
            cache = {}
            g._default_password_patterns = cache
        key = str(school_id)
        if key not in cache:
            from app.plugins.config_store import plugin_config_value

            resolved = {}
            for role, config_key in _CONFIG_KEYS.items():
                override = plugin_config_value(school_id, PLUGIN_SLUG, config_key, None)
                resolved[role] = _validate_pattern(override) or DEFAULT_PATTERNS[role]
            cache[key] = resolved
        patterns.update(cache[key])
    except Exception:  # noqa: BLE001 — config reads are best-effort, never raise
        return dict(DEFAULT_PATTERNS)
    return patterns


# ── credential derivation (pure — no DB access) ───────────────────────────────


def _name_tokens(user, student) -> dict:
    """first/last name tokens; the student row takes precedence over the
    user's full_name. Empty slugs fall back to "user"."""
    first = last = ""
    if student is not None:
        first = getattr(student, "first_name", None) or ""
        last = getattr(student, "last_name", None) or ""
    full_name = str(getattr(user, "full_name", "") or "")
    if not first:
        first = _first_token(full_name)
    if not last:
        tokens = full_name.split()
        last = tokens[-1] if len(tokens) > 1 else ""
    first_slug = _slug(first) or "user"
    return {
        "first": first_slug,
        "last": _slug(last),
        "firstinitial": first_slug[0],
    }


def _academic_tokens(student) -> dict:
    if student is None:
        return {"class": "", "section": "", "roll": ""}
    roll = getattr(student, "roll_number", None)
    return {
        "class": _slug(getattr(getattr(student, "klass", None), "name", None)),
        "section": _slug(getattr(getattr(student, "section", None), "name", None)),
        "roll": str(roll) if roll is not None else "",
    }


def _fallback_tokens(user, student, extra_phones=()) -> dict:
    """Graceful {first}.{last4} tokens when the primary scheme is missing
    its compulsory fields (no roll number, no linked child, …)."""
    phones = [getattr(user, "phone", None), *extra_phones]
    if student is not None:
        phones.append(_guardian_phone(student))
    tokens = _name_tokens(user, None)
    tokens.update({"class": "", "section": "", "roll": "", "last4": _last4(*phones)})
    return tokens


def _derive(user, student=None, school=None) -> dict:
    """Resolve pattern, base credential, tokens and uniqueness metadata.

    Returns {pattern, base, tokens, kind, inherent, school_id, user_id,
    last4, roll}. Pure — no DB access, no collision handling.
    """
    school_id = getattr(user, "school_id", None) or getattr(school, "id", None)
    role = _role_of(user)
    patterns = _patterns_for(school_id)

    if role == "student":
        row = _student_of(user, student)
        academic = _academic_tokens(row)
        names = _name_tokens(user, row)
        if academic["roll"] and names["first"]:
            pattern = patterns["student"]
            tokens = {**academic, **names, "last4": ""}
            inherent = (
                "{seq}" not in pattern
                and "{roll}" in pattern
                and "{class}" in pattern
                and "{section}" in pattern
                and bool(academic["class"])
                and bool(academic["section"])
            )
            return {
                "pattern": pattern,
                "base": _render(pattern, tokens),
                "tokens": tokens,
                "kind": "student",
                "inherent": inherent,
                "school_id": school_id,
                "user_id": getattr(user, "id", None),
                "roll": academic["roll"],
                "last4": "",
            }
        # No roll number → graceful first-name + last-4 fallback.
        pattern = patterns["staff"]
        tokens = _fallback_tokens(user, row)
        return {
            "pattern": pattern,
            "base": _render(pattern, tokens),
            "tokens": tokens,
            "kind": "student",
            "inherent": False,
            "school_id": school_id,
            "user_id": getattr(user, "id", None),
            "roll": "",
            "last4": tokens["last4"],
        }

    if role == "parent":
        child = student if student is not None else _child_of(user)
        own_phone = getattr(user, "phone", None)
        if child is not None:
            academic = _academic_tokens(child)
            names = _name_tokens(user, child)  # child's identity drives it
            last4 = _last4(own_phone, _guardian_phone(child))
            if academic["roll"] and last4 and names["first"]:
                pattern = patterns["parent"]
                tokens = {**academic, **names, "last4": last4}
                return {
                    "pattern": pattern,
                    "base": _render(pattern, tokens),
                    "tokens": tokens,
                    "kind": "parent",
                    "inherent": False,
                    "school_id": school_id,
                    "user_id": getattr(user, "id", None),
                    "roll": academic["roll"],
                    "last4": last4,
                }
        # No linked child (or child lacks roll) → parent's own name + phone.
        pattern = patterns["staff"]
        tokens = _fallback_tokens(user, child)
        return {
            "pattern": pattern,
            "base": _render(pattern, tokens),
            "tokens": tokens,
            "kind": "parent",
            "inherent": False,
            "school_id": school_id,
            "user_id": getattr(user, "id", None),
            "roll": "",
            "last4": tokens["last4"],
        }

    # staff / teacher / accountant / school_admin / anything else
    pattern = patterns["staff"]
    tokens = _fallback_tokens(user, _student_of(user, student))
    return {
        "pattern": pattern,
        "base": _render(pattern, tokens),
        "tokens": tokens,
        "kind": "staff",
        "inherent": False,
        "school_id": school_id,
        "user_id": getattr(user, "id", None),
        "roll": "",
        "last4": tokens["last4"],
    }


def _render(pattern: str, tokens: dict) -> str:
    """Substitute {tokens} and strip separators left dangling by empty
    tokens (e.g. "{class}{section}{roll}.{first}" with only a first name
    → ".ram" → "ram"). Returns "" when nothing survives."""
    out = _TOKEN_RE.sub(lambda m: str(tokens.get(m.group(1), "") or ""), pattern)
    return out.strip(".-_")


# ── collision handling ────────────────────────────────────────────────────────


def _db_base_taken(ctx: dict) -> bool:
    """Best-effort DB collision check: does another ACTIVE user in the same
    school derive the identical base credential?

    The users table has no username column and email/phone carry no unique
    constraint (app/models/user.py), so uniqueness is enforced on the
    derived credential itself: fetch the handful of same-school users that
    could possibly collide — matched cheaply on phone suffix for
    staff/parent patterns, on class roll for student fallbacks — and
    re-derive each one's base (pure, recursion-free) for comparison. Any
    failure (no app context, missing tables) returns False: uniqueness is
    best-effort, generation must never raise.
    """
    try:
        from app.models.user import User

        school_id = ctx["school_id"]
        if not school_id:
            return False

        base = ctx["base"]

        if ctx["kind"] == "student":
            from app.models.student import Student

            query = Student.query.filter(
                Student.school_id == school_id,
                Student.is_deleted.is_(False),
                Student.user_id.isnot(None),
            )
            user_id = ctx.get("user_id")
            if user_id is not None:
                query = query.filter(Student.user_id != user_id)
            if ctx["roll"]:
                query = query.filter(Student.roll_number.isnot(None))
            for row in query.limit(50):
                other = _derive(row.user, row)
                if other["base"] == base:
                    return True
            return False

        # staff / parent bases: only users whose phone ends with the same
        # 4 characters can possibly render the same {last4} token.
        if not ctx.get("last4"):
            return False
        query = User.query.filter(
            User.school_id == school_id,
            User.is_deleted.is_(False),
            User.phone.like(f"%{ctx['last4']}"),
        )
        user_id = ctx.get("user_id")
        if user_id is not None:
            query = query.filter(User.id != user_id)
        for other_user in query.limit(100):
            if _derive(other_user)["base"] == base:
                return True
        return False
    except Exception:  # noqa: BLE001 — never raise from a password generator
        return False


def _is_taken(candidate: str, ctx: dict, taken) -> bool:
    if taken is not None:
        return candidate in taken
    if ctx["inherent"]:
        # class+section+roll are unique per school — nothing to check
        return False
    return _db_base_taken(ctx)


# ── public API ────────────────────────────────────────────────────────────────


def generate_default_password(user, student=None, school=None, taken=None):
    """Deterministic, EMIS-free default password for a user.

    students → "{class}{section}{roll}.{first}"   e.g. 7a12.ram
    parents  → "p{roll}.{first}{last4}"           e.g. p12.ram4821
    others   → "{first}.{last4}"                  e.g. sita.4821

    (patterns overridable per school — see the module docstring). Always
    returns a non-empty lowercase-ASCII string; never raises.

    taken: optional set of already-issued credentials. When provided,
    collision resolution happens purely in memory and the chosen credential
    is added to the set — pass one shared set across a bulk import to avoid
    per-row DB queries.
    """
    try:
        ctx = _derive(user, student, school)
    except Exception:  # noqa: BLE001 — absolute last resort, still deterministic
        first = _slug(_first_token(getattr(user, "full_name", None))) or "user"
        last4 = _last4(getattr(user, "phone", None))
        base = f"{first}.{last4}" if last4 else first
        ctx = {
            "pattern": DEFAULT_PATTERNS["staff"],
            "base": base,
            "tokens": {"first": first, "last4": last4, "seq": "1"},
            "kind": "staff",
            "inherent": False,
            "school_id": getattr(user, "school_id", None),
            "user_id": getattr(user, "id", None),
            "roll": "",
            "last4": last4,
        }

    pattern = ctx["pattern"]
    has_seq = "{seq}" in pattern
    attempt = 1
    while True:
        tokens = dict(ctx["tokens"])
        tokens["seq"] = str(attempt)
        candidate = _render(pattern, tokens) or "user"
        if attempt > 1 and not has_seq:
            candidate = f"{candidate}-{attempt}"
        if not _is_taken(candidate, ctx, taken):
            if taken is not None:
                taken.add(candidate)
            return candidate
        attempt += 1
        if attempt > _MAX_ATTEMPTS:
            # give up uniqueness rather than loop forever — never raise
            return f"{candidate}-{attempt}"

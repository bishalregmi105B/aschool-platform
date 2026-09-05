"""Plugin contract validator — the CI gate for the plugin package v2 spec.

Why this exists: manifests are documentation as much as configuration, and
nothing ever checked them. `tests/test_plugin_manifests.py` only scanned the 8
legacy flat manifests, which is how ~20 broken `api_blueprint:`/`services:`
pointers, a plugin folder that was not even a Python package (`ai_suite` had no
`__init__.py`), and sidebar icons absent from the frontend ICON_MAP all survived
for months.

Severity contract
-----------------
`error`   — fails CI. Something is factually wrong: a pointer to a file that
            does not exist, a category outside the DB enum, a dependency on an
            unknown slug, a declared-but-missing file.
`warning` — printed, does not fail. Reserved for checks that are aspirational
            for v1 manifests but mandatory once a manifest declares
            `schema_version: 2` (the migration ratchet).

The ratchet is deliberate: a v1 manifest keeps working forever, but the moment
its author opts into v2 the same defect becomes a hard failure. That is what
lets 48 manifests migrate one PR at a time without a flag day.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path

import yaml

BACKEND_ROOT = Path(__file__).resolve().parents[2]
MODULES_DIR = Path(__file__).parent / "modules"
LEGACY_DIR = Path(__file__).parent / "manifests"

VALID_CATEGORIES = {"core", "starter", "growth", "premium", "add_on"}

# Kept in sync with frontend/components/layout/sidebar.tsx ICON_MAP. A manifest
# naming an icon outside this set renders the generic Package box, which is a
# silent downgrade nobody notices in review.
SIDEBAR_ICON_MAP_SOURCE = (
    BACKEND_ROOT.parent / "frontend" / "components" / "layout" / "sidebar.tsx"
)

# Sections the frontend sidebar knows how to group under, plus the two
# special values. Anything else renders ungrouped at the bottom.
VALID_SECTIONS = {
    None,
    "bottom_nav",
    "Academics",
    "Learning",
    "Money",
    "Operations",
    "Communication",
    "Design & Web",
    "Insights",
    "Student Life",
    "Safety & Compliance",
    "Growth",
    "Admin",
}

VALID_WIDGET_TYPES = {
    "stat-group",
    "dashboard-card",
    "table-panel",
    "chart",
    "list",
    "form",
    "detail-drawer",
    "quick-action",
    "settings-section",
    "mobile-card",
    "website-section",
}

VALID_WIDGET_SLOTS = {
    "dashboard.main",
    "dashboard.side",
    "dashboard.wide",
    "dashboard.actions",
    "plugin_page.main",
    "plugin_page.header",
    "student_profile.tab",
    "teacher_profile.tab",
    "class_detail.tab",
    "settings.section",
    "plugin_settings.section",
    "drawer",
    "dialog",
    "mobile.home",
    "mobile.quick_actions",
    "mobile.more",
    "website.section",
    "pdf.block",
}
# `mobile.<module>.tab` is a parameterized slot family.
_MOBILE_TAB_SLOT = re.compile(r"^mobile\.[a-z0-9_]+\.tab$")

VALID_SURFACES = {"web", "mobile", "public_site", "pdf"}

VALID_ROLES = {
    "superadmin",
    "school_admin",
    "teacher",
    "parent",
    "student",
    "accountant",
    "librarian",
    "staff",
}


@dataclass(frozen=True)
class Finding:
    severity: str  # "error" | "warning"
    slug: str
    file: str
    message: str

    def __str__(self) -> str:  # pragma: no cover — display only
        return f"[{self.severity.upper()}] {self.slug}: {self.message} ({self.file})"


def _load_icon_map() -> set[str]:
    """Parse the Lucide icon names registered in the frontend ICON_MAP.

    Reading the .tsx is deliberately crude but has no build step and cannot go
    stale: the map is a flat object of bare identifiers between `const
    ICON_MAP` and its closing brace.
    """
    try:
        source = SIDEBAR_ICON_MAP_SOURCE.read_text()
    except OSError:
        return set()
    start = source.find("const ICON_MAP")
    if start == -1:
        return set()
    end = source.find("\n};", start)
    body = source[start:end if end != -1 else len(source)]
    names: set[str] = set()
    for line in body.splitlines()[1:]:
        line = line.split("//")[0].strip().rstrip(",")
        if not line:
            continue
        # Entries are either `Users` or `QuestionMarkCircle: HelpCircle`.
        key = line.split(":")[0].strip()
        if key.isidentifier():
            names.add(key)
    return names


def _module_exists(dotted: str) -> bool:
    """True when a dotted module path resolves to a file/package on disk."""
    parts = str(dotted).split(".")
    if not parts or parts[0] not in ("app", "tests", "scripts"):
        return True  # third-party / out of tree — not ours to validate
    candidate = BACKEND_ROOT.joinpath(*parts)
    return candidate.with_suffix(".py").exists() or (candidate / "__init__.py").exists()


def _iter_manifest_files() -> list[tuple[Path, bool]]:
    """Every manifest on disk as (path, is_legacy), modules first."""
    files: list[tuple[Path, bool]] = []
    if MODULES_DIR.exists():
        for path in sorted(MODULES_DIR.rglob("manifest.yaml")):
            if path.parent == MODULES_DIR:
                continue
            files.append((path, False))
    if LEGACY_DIR.exists():
        for path in sorted(LEGACY_DIR.glob("*.yaml")):
            if not path.name.startswith("_"):
                files.append((path, True))
    return files


class PluginValidator:
    """Validates every manifest on disk against the plugin package contract."""

    def __init__(self) -> None:
        self.icon_map = _load_icon_map()
        self.manifests: dict[str, dict] = {}
        self.paths: dict[str, Path] = {}
        self.legacy: set[str] = set()
        self.findings: list[Finding] = []

    # ── loading ────────────────────────────────────────────────────────────

    def _add(self, severity: str, slug: str, path: Path | str, message: str) -> None:
        try:
            rel = str(Path(path).relative_to(BACKEND_ROOT))
        except (ValueError, TypeError):
            rel = str(path)
        self.findings.append(Finding(severity, slug, rel, message))

    def load(self) -> None:
        for path, is_legacy in _iter_manifest_files():
            try:
                data = yaml.safe_load(path.read_text())
            except yaml.YAMLError as e:
                self._add("error", path.stem, path, f"YAML does not parse: {e}")
                continue
            if not isinstance(data, dict):
                self._add("error", path.stem, path, "manifest is not a YAML mapping")
                continue
            slug = data.get("slug")
            if not slug:
                self._add("error", path.stem, path, "missing required key `slug`")
                continue
            if slug in self.manifests:
                self._add(
                    "error", slug, path,
                    f"duplicate slug — already declared by {self.paths[slug]}",
                )
                continue
            self.manifests[slug] = data
            self.paths[slug] = path
            if is_legacy:
                self.legacy.add(slug)

    # ── the checks ─────────────────────────────────────────────────────────

    def schema_version(self, slug: str) -> int:
        try:
            return int(self.manifests[slug].get("schema_version") or 1)
        except (TypeError, ValueError):
            return 1

    def _ratchet(self, slug: str) -> str:
        """`error` once the manifest opts into v2, `warning` while it is v1."""
        return "error" if self.schema_version(slug) >= 2 else "warning"

    def check_identity(self, slug: str) -> None:
        m, path = self.manifests[slug], self.paths[slug]
        expected = path.stem if slug in self.legacy else path.parent.name
        if slug != expected:
            self._add(
                "error", slug, path,
                f"slug `{slug}` does not match its location (expected `{expected}`)",
            )
        if not m.get("name"):
            self._add("error", slug, path, "missing required key `name`")
        if not m.get("description"):
            self._add(self._ratchet(slug), slug, path, "missing `description`")
        category = m.get("category")
        if not category:
            self._add("error", slug, path, "missing required key `category`")
        elif category not in VALID_CATEGORIES:
            self._add(
                "error", slug, path,
                f"category `{category}` is not in the plugins.category enum "
                f"{sorted(VALID_CATEGORIES)}",
            )
        elif category == "core" and float(m.get("price_monthly") or 0) != 0:
            self._add(
                "error", slug, path,
                f"core plugins ship with every plan but price_monthly="
                f"{m.get('price_monthly')}",
            )
        if slug not in self.legacy and not (path.parent / "__init__.py").exists():
            self._add(
                "error", slug, path,
                "module folder is not a Python package — add __init__.py "
                "(the loader imports routes/hooks/models by dotted path)",
            )

    def check_relations(self, slug: str) -> None:
        m, path = self.manifests[slug], self.paths[slug]
        known = set(self.manifests)
        for field in ("depends_on", "conflicts_with", "supersedes", "aliases"):
            values = m.get(field) or []
            if not isinstance(values, list):
                self._add("error", slug, path, f"`{field}` must be a list")
                continue
            for target in values:
                if target == slug:
                    self._add("error", slug, path, f"`{field}` points at itself")
                elif target not in known:
                    self._add(
                        "error", slug, path,
                        f"`{field}` references unknown slug `{target}`",
                    )

    def check_pointers(self, slug: str) -> None:
        """Every declared code pointer must resolve on disk.

        v1 manifests carry these at the top level, v2 under `capabilities:`;
        both shapes are checked so the migration needs no coordination.
        """
        m, path = self.manifests[slug], self.paths[slug]
        caps = m.get("capabilities") or {}
        singles = ("api_blueprint", "models_module", "health_check")
        lists = ("services", "tasks", "models")
        for field in singles:
            target = caps.get(field) or m.get(field)
            if not target:
                continue
            dotted = str(target).split(":")[0]  # health_check is module:callable
            if not _module_exists(dotted):
                self._add(
                    "error", slug, path,
                    f"`{field}` -> {target} (module does not exist on disk)",
                )
        for field in lists:
            for target in (caps.get(field) or m.get(field) or []):
                if not _module_exists(str(target)):
                    self._add(
                        "error", slug, path,
                        f"`{field}[]` -> {target} (module does not exist on disk)",
                    )

    def check_declared_files(self, slug: str) -> None:
        """A manifest that names a sidecar file must ship that file."""
        m, path = self.manifests[slug], self.paths[slug]
        if slug in self.legacy:
            return  # flat manifests have no folder to hold sidecars
        folder = path.parent
        simple = {
            "config_schema": "config_schema.yaml",
            "permissions_ref": None,
            "events_ref": None,
            "mobile_ref": None,
        }
        for key, default in simple.items():
            value = m.get(key)
            if value in (None, False):
                continue
            target = default if value is True else str(value)
            if target and not (folder / target).exists():
                self._add(
                    "error", slug, path,
                    f"`{key}` declares {target} but the file is missing",
                )
        widgets_ref = ((m.get("ui") or {}).get("widgets_ref")) or m.get("widgets_ref")
        if widgets_ref and not (folder / str(widgets_ref)).exists():
            self._add(
                "error", slug, path,
                f"`ui.widgets_ref` declares {widgets_ref} but the file is missing",
            )
        for pack in m.get("template_packs") or []:
            rel = (pack or {}).get("path")
            if rel and not (folder / str(rel)).exists():
                self._add(
                    "error", slug, path,
                    f"`template_packs[].path` -> {rel} does not exist",
                )
        for theme in m.get("theme_contributions") or []:
            rel = (theme or {}).get("path")
            if rel and not (folder / str(rel)).exists():
                self._add(
                    "error", slug, path,
                    f"`theme_contributions[].path` -> {rel} does not exist",
                )

    def check_nav(self, slug: str) -> None:
        """Sidebar/nav declarations, reading v1 `frontend:` or v2 `ui.nav`."""
        m, path = self.manifests[slug], self.paths[slug]
        nav = (m.get("ui") or {}).get("nav")
        if nav is None:
            fe = m.get("frontend") or {}
            sb = fe.get("sidebar") or {}
            if not fe:
                return  # API-only plugin
            nav = {
                "route": fe.get("route"),
                "section": sb.get("section"),
                "label": sb.get("label"),
                "icon": sb.get("icon") or m.get("icon"),
                "visible_to": sb.get("visible_to") or [],
                "subitems": sb.get("subitems") or [],
            }
            if not sb:
                return  # opted out of the sidebar
        route = nav.get("route")
        if route and not str(route).startswith("/"):
            self._add("error", slug, path, f"nav route `{route}` must start with /")
        if not nav.get("label"):
            self._add("error", slug, path, "nav declares no label")
        section = nav.get("section")
        if section not in VALID_SECTIONS:
            self._add(
                self._ratchet(slug), slug, path,
                f"nav section `{section}` is not a sidebar group "
                "(it will render ungrouped)",
            )
        icon = nav.get("icon")
        if icon and self.icon_map and icon not in self.icon_map:
            self._add(
                self._ratchet(slug), slug, path,
                f"icon `{icon}` is not in the frontend ICON_MAP — the sidebar "
                "will fall back to the generic Package box",
            )
        for role in nav.get("visible_to") or []:
            if role != "all" and role not in VALID_ROLES:
                self._add(
                    self._ratchet(slug), slug, path,
                    f"nav visible_to lists unknown role `{role}`",
                )
        for item in nav.get("subitems") or []:
            sub_route = (item or {}).get("route")
            if sub_route and not str(sub_route).startswith("/"):
                self._add(
                    "error", slug, path,
                    f"nav subitem route `{sub_route}` must start with /",
                )

    def check_widgets(self, slug: str) -> None:
        """Validate `widgets.yaml` against the widget contract.

        Only the structural rules live here — that a widget names a legal type,
        asks for a slot the host actually owns, declares a renderer the host can
        resolve, and points its data source at its own plugin's API. Binding
        tokens are resolved at render time, not here.
        """
        if slug in self.legacy:
            return
        path = self.paths[slug]
        widgets_file = path.parent / "widgets.yaml"
        if not widgets_file.exists():
            return
        try:
            doc = yaml.safe_load(widgets_file.read_text()) or {}
        except yaml.YAMLError as e:
            self._add("error", slug, widgets_file, f"widgets.yaml does not parse: {e}")
            return
        widgets = doc.get("widgets") if isinstance(doc, dict) else None
        if not isinstance(widgets, list):
            self._add("error", slug, widgets_file, "widgets.yaml needs a `widgets:` list")
            return

        index_file = path.parent / "ui" / "index.web.json"
        component_tokens: set[str] = set()
        if index_file.exists():
            import json

            try:
                component_tokens = set((json.loads(index_file.read_text()) or {}).values())
            except (OSError, ValueError) as e:
                self._add("error", slug, index_file, f"ui/index.web.json invalid: {e}")

        seen: set[str] = set()
        for entry in widgets:
            if not isinstance(entry, dict):
                self._add("error", slug, widgets_file, "widget entry is not a mapping")
                continue
            key = entry.get("key")
            if not key:
                self._add("error", slug, widgets_file, "widget entry has no `key`")
                continue
            if key in seen:
                self._add("error", slug, widgets_file, f"duplicate widget key `{key}`")
            seen.add(key)
            wtype = entry.get("type")
            if wtype not in VALID_WIDGET_TYPES:
                self._add(
                    "error", slug, widgets_file,
                    f"widget `{key}`: type `{wtype}` is not one of "
                    f"{sorted(VALID_WIDGET_TYPES)}",
                )
            renderer = entry.get("renderer") or "spec"
            if renderer not in ("spec", "component"):
                self._add(
                    "error", slug, widgets_file,
                    f"widget `{key}`: renderer must be `spec` or `component`",
                )
            elif renderer == "spec" and not entry.get("spec"):
                self._add(
                    "error", slug, widgets_file,
                    f"widget `{key}`: renderer `spec` requires a `spec:` body",
                )
            elif renderer == "component":
                token = entry.get("component")
                if not token:
                    self._add(
                        "error", slug, widgets_file,
                        f"widget `{key}`: renderer `component` requires `component:`",
                    )
                elif component_tokens and token not in component_tokens:
                    self._add(
                        "error", slug, widgets_file,
                        f"widget `{key}`: component `{token}` is not declared in "
                        "ui/index.web.json",
                    )
            for surface in entry.get("surfaces") or []:
                if surface not in VALID_SURFACES:
                    self._add(
                        "error", slug, widgets_file,
                        f"widget `{key}`: unknown surface `{surface}`",
                    )
            if "public_site" in (entry.get("surfaces") or []):
                caps = self.manifests[slug].get("capabilities") or {}
                if not caps.get("public_routes"):
                    self._add(
                        "error", slug, widgets_file,
                        f"widget `{key}` targets the public site but the manifest "
                        "does not declare `capabilities.public_routes: true`",
                    )
            slots = entry.get("slots") or []
            if isinstance(slots, dict):
                slots = [slots]
            if not slots:
                self._add(
                    "error", slug, widgets_file,
                    f"widget `{key}`: no `slots` — it can never be placed",
                )
            for slot in slots:
                slot_id = slot if isinstance(slot, str) else (slot or {}).get("id")
                if not slot_id:
                    self._add(
                        "error", slug, widgets_file,
                        f"widget `{key}`: slot entry has no id",
                    )
                elif slot_id not in VALID_WIDGET_SLOTS and not _MOBILE_TAB_SLOT.match(
                    str(slot_id)
                ):
                    self._add(
                        "error", slug, widgets_file,
                        f"widget `{key}`: slot `{slot_id}` is not a host-owned slot "
                        "(plugins cannot invent render points)",
                    )
            for role in entry.get("roles") or []:
                if role not in VALID_ROLES:
                    self._add(
                        self._ratchet(slug), slug, widgets_file,
                        f"widget `{key}`: unknown role `{role}`",
                    )
            data = entry.get("data") or {}
            source = data.get("source", "api" if data else None)
            if source and source not in ("api", "socket", "static", "aggregate"):
                self._add(
                    "error", slug, widgets_file,
                    f"widget `{key}`: data.source `{source}` is not supported",
                )
            if source == "api" and not data.get("endpoint"):
                self._add(
                    "error", slug, widgets_file,
                    f"widget `{key}`: data.source api requires an `endpoint`",
                )
            endpoint = data.get("endpoint")
            if endpoint and not str(endpoint).startswith("/"):
                self._add(
                    "error", slug, widgets_file,
                    f"widget `{key}`: endpoint `{endpoint}` must be relative to "
                    "/api/v1 and start with /",
                )

    def check_ownership(self) -> None:
        """`owns_tables` must name exactly one owner per table.

        This is the check that finally makes "who may drop this table?"
        answerable. The duplicate-health-model finding in the dedup audit is a
        direct consequence of nobody owning `student_health_records`.
        """
        owners: dict[str, list[str]] = {}
        for slug, m in self.manifests.items():
            for table in m.get("owns_tables") or []:
                owners.setdefault(str(table), []).append(slug)
        for table, claimants in owners.items():
            if len(claimants) > 1:
                for slug in claimants:
                    self._add(
                        self._ratchet(slug), slug, self.paths[slug],
                        f"table `{table}` is claimed by {sorted(claimants)} — "
                        "exactly one plugin may own a table",
                    )

    # ── entry point ────────────────────────────────────────────────────────

    def run(self) -> list[Finding]:
        # Reset ALL per-run state: run() is called twice in doctor --fix-safe
        # (once for the report, once for the dirty set) and stale `manifests`
        # made every manifest report itself as a duplicate slug on the second
        # pass — which silently skipped the entire ratchet wave.
        self.manifests = {}
        self.paths = {}
        self.legacy = set()
        self.findings = []
        self.load()
        for slug in sorted(self.manifests):
            self.check_identity(slug)
            self.check_relations(slug)
            self.check_pointers(slug)
            self.check_declared_files(slug)
            self.check_nav(slug)
            self.check_widgets(slug)
        self.check_ownership()
        return self.findings


def validate_all() -> list[Finding]:
    """Run every check over every manifest on disk."""
    return PluginValidator().run()


def errors_only(findings: list[Finding] | None = None) -> list[Finding]:
    findings = validate_all() if findings is None else findings
    return [f for f in findings if f.severity == "error"]


def format_table(findings: list[Finding]) -> str:
    """Render findings grouped by severity for a terminal."""
    if not findings:
        return "All manifests pass the plugin contract."
    lines: list[str] = []
    for severity in ("error", "warning"):
        group = [f for f in findings if f.severity == severity]
        if not group:
            continue
        lines.append(f"\n{severity.upper()}S ({len(group)})")
        lines.append("-" * 78)
        width = max(len(f.slug) for f in group)
        for f in sorted(group, key=lambda x: (x.slug, x.message)):
            lines.append(f"  {f.slug:<{width}}  {f.message}")
            lines.append(f"  {'':<{width}}  ↳ {f.file}")
    return "\n".join(lines)


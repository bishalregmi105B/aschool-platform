"""White-Label Branding Service — branding overrides + real custom-domain DNS verification.

Where the data lives and who consumes it (write-through, no duplicate source):
  - ``School.logo_url``                      → public site payload (``/website/public/<slug>``)
                                               metadata, navbar logo.
  - ``SchoolWebsite.customizations``         → ``WebsiteBuilderService.get_website_config``
                                               (flat keys) and the public site layout, which
                                               applies ``customizations["colors"]`` over the
                                               active theme palette (generateThemeCSS).
  - ``School.settings["white_label"]``       → admin-app theme overrides + branding identity
                                               (display name, tagline, footer text, sender
                                               name, hide-branding flag, font family).

Uninstall behavior: consistent with the platform's soft-uninstall (``uninstall_plugin``
sets active=False and reports ``data_preserved: True`` — nothing is destroyed). The
branding-REMOVAL capabilities (hide "Powered by ASchool", custom display name, footer
text, sender name) only apply while the plugin is active; after uninstall the platform
branding returns even though the stored values are preserved.
"""

import logging
import os
import re

from flask import current_app

logger = logging.getLogger(__name__)

_HEX_COLOR_RE = re.compile(r"^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$")
_DOMAIN_RE = re.compile(r"^(?!-)[a-zA-Z0-9-]{1,63}(\.[a-zA-Z0-9-]{1,63})+$")

_THEME_KEYS = (
    "mode", "sidebar_style", "card_style", "density",
    "accent_color", "sidebar_color", "sidebar_text_color",
)
_BRANDING_KEYS = (
    "school_name_display", "tagline", "footer_text", "sender_name", "font_family",
)

DEFAULT_BRANDING = {
    "school_name_display": "",
    "tagline": "",
    "primary_color": "",
    "secondary_color": "",
    "font_family": "",
    "footer_text": "",
    "sender_name": "",
    "hide_aschool_branding": False,
    "logo_url": "",
}

DEFAULT_THEME = {
    "mode": "light",
    "sidebar_style": "default",
    "card_style": "rounded",
    "density": "comfortable",
    "accent_color": "#2563EB",
    "sidebar_color": "#1e293b",
    "sidebar_text_color": "#f8fafc",
}


def _clean_domain(raw: str) -> str:
    """Normalize a user-supplied domain: strip scheme/port/path, lowercase."""
    domain = (raw or "").strip().lower()
    domain = re.sub(r"^https?://", "", domain)
    domain = domain.split("/")[0].split(":")[0].strip(".")
    if domain.startswith("www."):
        domain = domain[4:]
    return domain


def _validate_domain(domain: str) -> str | None:
    """Return an error message, or None when the domain is acceptable."""
    if not domain or not _DOMAIN_RE.match(domain):
        return "Enter a valid domain, e.g. school.yourschool.edu.np"
    if len(domain) > 253:
        return "Domain is too long"
    base = current_app.config.get("BASE_DOMAIN", "aschool.com.np")
    if domain == base or domain.endswith(f".{base}"):
        return f"Domains under {base} are platform subdomains — use your own domain"
    return None


class WhiteLabelService:
    """Per-school white-label branding state, DNS verification, and read-throughs."""

    # ── storage helpers ───────────────────────────────────────────────

    @staticmethod
    def _school(school_id):
        from app.models.school import School

        return School.query.get(school_id)

    @classmethod
    def _website(cls, school_id):
        from app.models.school import SchoolWebsite
        from extensions import db

        website = SchoolWebsite.query.filter_by(
            school_id=school_id, is_deleted=False
        ).first()
        if not website:
            website = SchoolWebsite(school_id=school_id)
            db.session.add(website)
            db.session.flush()
        return website

    @staticmethod
    def _stored(school, key):
        """Read settings["white_label"][key] (e.g. key='branding' or 'theme')."""
        wl = (school.settings or {}).get("white_label") if school else None
        if not isinstance(wl, dict):
            return {}
        stored = wl.get(key)
        return stored if isinstance(stored, dict) else {}

    @classmethod
    def _plugin_active(cls, school_id) -> bool:
        """Is the white_label plugin currently installed + active for this school?"""
        from app.plugins.decorators import _school_has_plugin

        return _school_has_plugin(str(school_id), "white_label")

    # ── branding ──────────────────────────────────────────────────────

    @classmethod
    def get_branding(cls, school_id) -> dict:
        """Effective branding: stored settings/customizations merged over defaults."""
        school = cls._school(school_id)
        if not school:
            return dict(DEFAULT_BRANDING)

        stored = dict(cls._stored(school, "branding"))
        website = cls._website(school_id)
        customizations = website.customizations or {}

        branding = dict(DEFAULT_BRANDING)
        # Colors may also have been set through the website builder — read both.
        for key in ("primary_color", "secondary_color"):
            branding[key] = stored.get(key) or customizations.get(key) or ""
        for key in ("tagline", "font_family"):
            branding[key] = stored.get(key) or customizations.get(key) or ""
        branding["logo_url"] = stored.get("logo_url") or school.logo_url or ""
        for key in ("school_name_display", "footer_text", "sender_name"):
            branding[key] = stored.get(key) or ""
        branding["hide_aschool_branding"] = bool(stored.get("hide_aschool_branding"))
        return branding

    @classmethod
    def save_branding(cls, school_id, data: dict) -> dict:
        """Persist branding and write through to the consumers listed in the module docstring."""
        from extensions import db

        school = cls._school(school_id)
        if not school:
            raise ValueError("School not found")

        stored = dict(cls._stored(school, "branding"))
        updates = {}

        for key in _BRANDING_KEYS:
            if key in data:
                value = (data.get(key) or "").strip()
                if len(value) > 300:
                    raise ValueError(f"{key} is too long (max 300 chars)")
                stored[key] = value
                updates[key] = value
        for key in ("primary_color", "secondary_color"):
            if key in data:
                value = (data.get(key) or "").strip()
                if value and not _HEX_COLOR_RE.match(value):
                    raise ValueError(f"{key} must be a hex color like #2563EB")
                stored[key] = value
                updates[key] = value
        if "logo_url" in data:
            value = (data.get("logo_url") or "").strip()
            if value and not re.match(r"^https?://", value):
                raise ValueError("logo_url must be an http(s) URL")
            if len(value) > 2000:
                raise ValueError("logo_url is too long")
            stored["logo_url"] = value
            updates["logo_url"] = value
            school.logo_url = value or None  # consumed by the public site payload
        if "hide_aschool_branding" in data:
            stored["hide_aschool_branding"] = bool(data.get("hide_aschool_branding"))
            updates["hide_aschool_branding"] = stored["hide_aschool_branding"]

        # settings["white_label"] must keep sibling keys (e.g. theme) intact.
        wl = dict((school.settings or {}).get("white_label") or {})
        wl["branding"] = stored
        school.settings = {**(school.settings or {}), "white_label": wl}
        # JSONB replace-assignment is equality-compared at flush — mark the
        # column modified explicitly so the write can never be silently
        # skipped (E142: a skipped flush made theme/branding saves flaky).
        from sqlalchemy.orm.attributes import flag_modified

        flag_modified(school, "settings")

        # Write-through: the website/branding layer reads these fields directly.
        website = cls._website(school_id)
        customizations = dict(website.customizations or {})
        if updates.get("primary_color"):
            customizations["primary_color"] = updates["primary_color"]
        if updates.get("secondary_color"):
            customizations["secondary_color"] = updates["secondary_color"]
        if updates.get("tagline") is not None and updates.get("tagline") != "":
            customizations["tagline"] = updates["tagline"]
        if updates.get("font_family"):
            customizations["font_family"] = updates["font_family"]
        if updates.get("logo_url"):
            customizations["logo_url"] = updates["logo_url"]
        # ``colors`` dict is what the public site layout feeds into generateThemeCSS
        # (app/school/[slug]/layout.tsx reads customizations.colors).
        colors = dict(customizations.get("colors") or {})
        if updates.get("primary_color"):
            colors["primary"] = updates["primary_color"]
        if updates.get("secondary_color"):
            colors["secondary"] = updates["secondary_color"]
        if colors:
            customizations["colors"] = colors
        # Effective branding flags ride along in the public payload so the site
        # layer can honor them (set only while the plugin is active).
        customizations["white_label"] = cls.get_effective_flags(school_id)
        website.customizations = customizations

        db.session.commit()
        return cls.get_branding(school_id)

    # ── effective flags (uninstall-aware) ─────────────────────────────

    @classmethod
    def get_effective_flags(cls, school_id) -> dict:
        """Branding-removal flags — only apply while white_label is active.

        Data is preserved on soft-uninstall (platform convention), but the
        removal itself stops: ASchool branding and the default school name
        come back, footer text and sender name stop being applied.
        """
        school_row = cls._school(school_id)
        stored = dict(cls._stored(school_row, "branding")) if school_row else {}
        active = cls._plugin_active(school_id)
        return {
            "active": active,
            "school_name_display": (stored.get("school_name_display") or "") if active else "",
            "footer_text": (stored.get("footer_text") or "") if active else "",
            "sender_name": (stored.get("sender_name") or "") if active else "",
            "hide_aschool_branding": bool(stored.get("hide_aschool_branding")) and active,
        }

    @classmethod
    def website_config_overrides(cls, school_id) -> dict:
        """Overrides merged into ``WebsiteBuilderService.get_website_config``."""
        flags = cls.get_effective_flags(school_id)
        overrides: dict = {}
        if flags.get("school_name_display"):
            overrides["school_name"] = flags["school_name_display"]
        if flags.get("footer_text"):
            overrides["footer_text"] = flags["footer_text"]
        overrides["hide_aschool_branding"] = flags.get("hide_aschool_branding", False)
        return overrides

    @classmethod
    def brand_colors(cls, school_id) -> dict:
        """Stored white-label brand colors — consumed by ThemeEngineService.apply_theme.

        Only settings["white_label"]["branding"] counts here. The flat
        customizations.primary_color/secondary_color mirrors are the website
        builder's own theme palette (apply_theme rewrites them on every theme
        change); counting them as "brand" made every previously applied theme
        permanently override later theme selections.
        """
        school = cls._school(school_id)
        stored = dict(cls._stored(school, "branding")) if school else {}
        colors = {}
        if stored.get("primary_color"):
            colors["primary"] = stored["primary_color"]
        if stored.get("secondary_color"):
            colors["secondary"] = stored["secondary_color"]
        return colors

    @classmethod
    def get_sms_sender_identity(cls, school_id) -> str | None:
        """White-labeled sender name for outgoing messages, or None for the platform default."""
        return cls.get_effective_flags(school_id).get("sender_name") or None

    # ── admin-app theme ───────────────────────────────────────────────

    @classmethod
    def get_theme(cls, school_id) -> dict:
        school = cls._school(school_id)
        stored = dict(cls._stored(school, "theme")) if school else {}
        theme = dict(DEFAULT_THEME)
        for key in _THEME_KEYS:
            if stored.get(key):
                theme[key] = stored[key]
        return theme

    @classmethod
    def save_theme(cls, school_id, data: dict) -> dict:
        from extensions import db

        school = cls._school(school_id)
        if not school:
            raise ValueError("School not found")

        stored = dict(cls._stored(school, "theme"))
        for key in _THEME_KEYS:
            if key not in data:
                continue
            value = (data.get(key) or "").strip()
            if key.endswith("_color"):
                if value and not _HEX_COLOR_RE.match(value):
                    raise ValueError(f"{key} must be a hex color like #2563EB")
            elif key == "mode" and value not in ("light", "dark", "system"):
                raise ValueError("mode must be light, dark, or system")
            elif key == "sidebar_style" and value not in ("default", "compact", "icon-only"):
                raise ValueError("sidebar_style must be default, compact, or icon-only")
            elif key == "card_style" and value not in ("rounded", "sharp", "flat"):
                raise ValueError("card_style must be rounded, sharp, or flat")
            elif key == "density" and value not in ("comfortable", "compact", "spacious"):
                raise ValueError("density must be comfortable, compact, or spacious")
            if value:
                stored[key] = value

        wl = dict(school.settings or {}).get("white_label") or {}
        wl["theme"] = stored
        school.settings = {**(school.settings or {}), "white_label": wl}
        # E142: explicit JSONB dirty-flag — see save_branding comment.
        from sqlalchemy.orm.attributes import flag_modified

        flag_modified(school, "settings")
        db.session.commit()
        return cls.get_theme(school_id)

    # ── custom domain: REAL DNS verification ──────────────────────────

    @classmethod
    def get_domain_status(cls, school) -> dict:
        base = current_app.config.get("BASE_DOMAIN", "aschool.com.np")
        subdomain = school.slug if school else None
        cname_target = f"{subdomain}.{base}" if subdomain else None
        custom_domain = (school.custom_domain or "") if school else ""
        domain_verified = bool(school.domain_verified) if school else False
        if not custom_domain:
            status = "not_configured"
        elif domain_verified:
            status = "active"
        else:
            status = "pending"
        return {
            "custom_domain": custom_domain or None,
            "domain_verified": domain_verified,
            "status": status,
            "subdomain": subdomain,
            "default_domain": cname_target,
            "cname_target": cname_target,
            "base_domain": base,
            "dns_records": (
                [{
                    "type": "CNAME",
                    "name": custom_domain.split(".")[0] if custom_domain.count(".") > 1 else "www",
                    "value": cname_target,
                }]
                if custom_domain and cname_target
                else []
            ),
        }

    @classmethod
    def set_domain(cls, school, raw_domain: str) -> dict:
        """Save a custom-domain request. Verification resets until DNS checks out."""
        from extensions import db

        domain = _clean_domain(raw_domain)
        error = _validate_domain(domain)
        if error:
            raise ValueError(error)
        if school.custom_domain != domain:
            school.domain_verified = False
        school.custom_domain = domain
        db.session.commit()
        return cls.get_domain_status(school)

    @classmethod
    def verify_domain_dns(cls, school) -> dict:
        """Perform a REAL DNS lookup of the school's custom domain.

        Verified  → the domain's CNAME points into the platform base domain
                    (``<slug>.<BASE_DOMAIN>``) or, when PLATFORM_IP is set,
                    its A record equals that IP.
        Pending   → the domain does not resolve at all yet (typical while DNS
                    propagation is in progress).
        Failed    → the domain resolves, but not to this platform.

        This is a live resolver query (dnspython with a socket fallback) —
        no mock, no unconditional success.
        """
        import socket
        from extensions import db

        if not school.custom_domain:
            raise ValueError("No custom domain configured")

        base = current_app.config.get("BASE_DOMAIN", "aschool.com.np")
        expected_cname = f"{school.slug}.{base}".lower()
        platform_ip = (os.getenv("PLATFORM_IP") or "").strip()

        cname_targets: list[str] = []
        a_records: list[str] = []
        lookup_errors: list[str] = []
        resolved = False

        # Preferred path: dnspython (installed in the runtime image).
        try:
            import dns.exception
            import dns.resolver

            resolver = dns.resolver.Resolver()
            resolver.timeout = 3
            resolver.lifetime = 6
            try:
                for rdata in resolver.resolve(school.custom_domain, "CNAME"):
                    cname_targets.append(str(rdata.target).rstrip(".").lower())
            except dns.resolver.NoAnswer:
                pass
            except (dns.resolver.NXDOMAIN, dns.resolver.NoNameservers) as e:
                lookup_errors.append(type(e).__name__)
            try:
                for rdata in resolver.resolve(school.custom_domain, "A"):
                    a_records.append(str(rdata))
            except dns.resolver.NoAnswer:
                pass
            except (dns.resolver.NXDOMAIN, dns.resolver.NoNameservers) as e:
                lookup_errors.append(type(e).__name__)
        except ImportError:
            lookup_errors.append("dnspython_unavailable")

        # Fallback / cross-check: stdlib resolution for the A record.
        if not a_records and not cname_targets:
            try:
                answers = socket.getaddrinfo(school.custom_domain, None, socket.AF_INET)
                a_records = sorted({a[4][0] for a in answers})
            except OSError as e:
                lookup_errors.append(f"socket:{e.__class__.__name__}")

        resolved = bool(cname_targets or a_records)

        platform_targets = tuple(
            t for t in (expected_cname, base) if t
        )
        cname_ok = any(
            target == expected_cname or target == base or target.endswith(f".{base}")
            for target in cname_targets
        )
        a_ok = bool(platform_ip) and platform_ip in a_records

        if cname_ok or a_ok:
            verdict = "verified"
            message = f"{school.custom_domain} resolves to this platform"
        elif not resolved:
            verdict = "pending"
            message = (
                f"No DNS records found for {school.custom_domain} yet — add the CNAME "
                f"pointing to {expected_cname} and retry once it propagates"
            )
        else:
            verdict = "failed"
            message = (
                f"{school.custom_domain} resolves, but not to this platform "
                f"(expected CNAME {expected_cname}"
                + (f" or A record {platform_ip}" if platform_ip else "")
                + ")"
            )

        school.domain_verified = verdict == "verified"
        db.session.commit()

        return {
            "custom_domain": school.custom_domain,
            "status": "active" if verdict == "verified" else verdict,
            "verified": verdict == "verified",
            "domain_verified": school.domain_verified,
            "verdict": verdict,
            "message": message,
            "expected_cname": expected_cname,
            "platform_ip": platform_ip or None,
            "records": {"cname": cname_targets, "a": a_records},
            "lookup_errors": lookup_errors or None,
        }

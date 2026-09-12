"""Per-user AOS desktop state — theme, wallpaper, dock, widgets, folders.

Persisted server-side so a user's desktop experience follows them across
devices and browsers (localStorage only survives a single browser profile).
"""
from sqlalchemy import Column, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID

from app.models.base import BaseModel


class UserAOSSettings(BaseModel):
    __tablename__ = "user_aos_settings"
    __table_args__ = (
        UniqueConstraint("user_id", name="uq_user_aos_settings_user"),
    )

    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # Appearance (defaults mirror the shell's hardcoded defaults so the
    # frontend can treat a missing row as "all defaults").
    theme_mode = Column(String(10), nullable=False, default="dark")
    accent_color = Column(String(20), nullable=False, default="#0078d4")
    wallpaper = Column(String(200), nullable=False, default="bloom-dark")
    brightness = Column(String(10), nullable=False, default="100")

    # Shell chrome
    dock_style = Column(String(10), nullable=False, default="mac")
    dock_size = Column(String(10), nullable=False, default="medium")
    show_top_bar = Column(String(10), nullable=False, default="true")
    top_bar_height = Column(String(10), nullable=False, default="standard")
    blur_intensity = Column(String(10), nullable=False, default="30")
    taskbar_align = Column(String(10), nullable=False, default="center")
    system_mode = Column(String(10), nullable=False, default="")

    # Launcher organization: pinned dock apps, desktop folder layout, the
    # home widget board, and visible topbar items. Free-form JSON owned by
    # the frontend.
    pinned_apps = Column(JSONB, nullable=False, default=list)
    desktop_folders = Column(JSONB, nullable=False, default=list)
    home_widgets = Column(JSONB, nullable=False, default=list)
    topbar_items = Column(JSONB, nullable=False, default=list)
    # Free-form desktop arrangement: icon/folder positions + widget layout.
    desktop_layout = Column(JSONB, nullable=False, default=dict)

    def to_dict(self):
        return {
            "theme_mode": self.theme_mode,
            "accent_color": self.accent_color,
            "wallpaper": self.wallpaper,
            "brightness": self.brightness,
            "dock_style": self.dock_style,
            "dock_size": self.dock_size,
            "show_top_bar": self.show_top_bar,
            "top_bar_height": self.top_bar_height,
            "blur_intensity": self.blur_intensity,
            "taskbar_align": self.taskbar_align,
            "system_mode": self.system_mode,
            "pinned_apps": self.pinned_apps or [],
            "desktop_folders": self.desktop_folders or [],
            "home_widgets": self.home_widgets or [],
            "topbar_items": self.topbar_items or [],
            "desktop_layout": self.desktop_layout or {},
        }

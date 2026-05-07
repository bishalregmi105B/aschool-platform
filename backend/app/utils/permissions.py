"""Role-Based Access Control permission definitions."""

# Module-level permissions per role.
# Format: { role: { module: [actions] } }
ROLE_PERMISSIONS = {
    "superadmin": {"*": ["*"]},
    "school_admin": {
        "school": ["read", "write"],
        "users": ["read", "write", "delete"],
        "students": ["read", "write", "delete"],
        "teachers": ["read", "write", "delete"],
        "attendance": ["read", "write"],
        "exams": ["read", "write", "delete"],
        "fees": ["read", "write"],
        "notices": ["read", "write", "delete"],
        "reports": ["read"],
        "plugins": ["read", "write"],
        "website": ["read", "write"],
        "social": ["read", "write"],
        "transport": ["read", "write"],
        "lms": ["read", "write"],
        "admission": ["read", "write"],
        "settings": ["read", "write"],
    },
    "accountant": {
        "fees": ["read", "write"],
        "students": ["read"],
        "reports": ["read"],
    },
    "teacher": {
        "attendance": ["read", "write"],
        "exams": ["read", "write"],
        "assignments": ["read", "write"],
        "students": ["read"],
        "notices": ["read"],
        "lms": ["read", "write"],
        "reports": ["read"],
    },
    "staff": {
        "attendance": ["read"],
        "notices": ["read"],
        "students": ["read"],
    },
    "parent": {
        "attendance": ["read"],
        "exams": ["read"],
        "fees": ["read"],
        "notices": ["read"],
        "transport": ["read"],
        "assignments": ["read"],
    },
    "student": {
        "attendance": ["read"],
        "exams": ["read"],
        "assignments": ["read", "write"],
        "notices": ["read"],
        "lms": ["read"],
        "library": ["read"],
    },
}


def has_permission(role: str, module: str, action: str, overrides: dict = None) -> bool:
    """Check if a role has permission for a module action."""
    # Check user-level overrides first
    if overrides:
        module_perms = overrides.get(module, [])
        if action in module_perms:
            return True

    role_perms = ROLE_PERMISSIONS.get(role, {})

    # Superadmin wildcard
    if "*" in role_perms and "*" in role_perms["*"]:
        return True

    module_perms = role_perms.get(module, [])
    return action in module_perms

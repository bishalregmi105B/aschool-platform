# Plugin Development Guide

## Overview

ASchool's plugin system allows modular feature development. Each plugin is defined by a YAML manifest and can include backend routes, database models, frontend pages, and Flutter screens.

## Plugin Structure

```
backend/app/plugins/manifests/my_plugin.yaml    # Manifest definition
backend/app/api/v1/my_plugin.py                  # API routes (Flask Blueprint)
backend/app/models/my_plugin.py                  # Database models
frontend/app/dashboard/my-plugin/page.tsx         # Frontend page
flutter_*/lib/features/my_plugin/                # Flutter screens
```

## Creating a New Plugin

### 1. Define the Manifest

Create `backend/app/plugins/manifests/my_plugin.yaml`:

```yaml
slug: my_plugin
name: "My Plugin"
name_nepali: "मेरो प्लगइन"
category: starter              # core, starter, growth, premium
price_monthly: 299
price_yearly: 2999
emoji: "🔧"
icon: "Wrench"
description: "Description of what this plugin does"

api_blueprint: "app.api.v1.my_plugin"
models_module: "app.models.my_plugin"

depends_on: []                 # List of plugin slugs this depends on
conflicts_with: []             # List of slugs that conflict

frontend:
  route: "/my-plugin"
  sidebar:
    label: "My Plugin"
    label_nepali: "मेरो प्लगइन"
    icon: "Wrench"
    subitems:
      - { label: "Dashboard", route: "/my-plugin/dashboard" }
      - { label: "Settings", route: "/my-plugin/settings" }
    visible_to: ["school_admin", "teacher"]

flutter:
  admin_app: { feature_folder: "my_plugin", tabs: ["Overview"] }
  teacher_app: { feature_folder: "my_plugin", tabs: ["My View"] }
```

### 2. Create API Routes

Create `backend/app/api/v1/my_plugin.py`:

```python
from flask import Blueprint, request
from app.utils.decorators import jwt_required, plugin_required, roles_required

bp = Blueprint('my_plugin', __name__, url_prefix='/api/v1/my-plugin')

@bp.route('/', methods=['GET'])
@jwt_required
@plugin_required('my_plugin')
def list_items():
    # Your logic here
    return {'success': True, 'data': {'items': []}}
```

### 3. Access Control

Use the `@plugin_required` decorator to ensure the school has installed the plugin:

```python
@bp.route('/data')
@jwt_required
@plugin_required('my_plugin')    # Checks InstalledPlugin for current school
@roles_required('school_admin', 'teacher')  # Role check
def get_data():
    ...
```

### 4. Frontend Integration

Use `PluginGate` to conditionally render UI:

```tsx
// Next.js frontend
import { PluginGate } from '@/components/plugin-gate'

export default function MyPluginPage() {
  return (
    <PluginGate pluginSlug="my_plugin">
      <MyPluginDashboard />
    </PluginGate>
  )
}
```

### 5. Flutter Integration

```dart
// Flutter apps
PluginGate(
  pluginSlug: 'my_plugin',
  child: MyPluginScreen(),
  fallback: UpgradePrompt(slug: 'my_plugin'),
)
```

## Plugin Categories

| Category | Price Range | Trial | Target |
|----------|------------|-------|--------|
| **core** | Free (Rs. 0) | N/A | All schools |
| **starter** | Rs. 199-399/mo | 14 days | Small schools |
| **growth** | Rs. 199-799/mo | 14 days | Growing schools |
| **premium** | Rs. 999-2,999/mo | 7 days | Large institutions |

## Plugin Discovery

The `PluginLoader` (in `backend/app/plugins/loader.py`) automatically:
1. Scans `manifests/` directory for YAML files
2. Validates required fields (slug, name, category)
3. Registers Flask blueprints referenced in `api_blueprint`
4. Makes manifest data available via `PluginLoader.get_all_manifests()`

## Testing Your Plugin

```python
# backend/tests/test_my_plugin.py
def test_requires_plugin_installed(client, admin_user, get_auth_headers):
    headers = get_auth_headers(admin_user)
    resp = client.get('/api/v1/my-plugin/', headers=headers)
    assert resp.status_code == 403  # Plugin not installed

def test_works_when_installed(client, admin_user, installed_plugin, get_auth_headers):
    headers = get_auth_headers(admin_user)
    resp = client.get('/api/v1/my-plugin/', headers=headers)
    assert resp.status_code == 200
```

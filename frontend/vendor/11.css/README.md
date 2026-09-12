# 11.css — Windows 11 Fluent Design System

[![npm](https://img.shields.io/npm/v/11.css)](https://www.npmjs.com)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**11.css** is a modern CSS framework that takes semantic HTML and transforms it into an authentic, faithful recreation of the **Windows 11 Fluent 2 Design System**.

It features real **Mica material**, **Acrylic backdrop blur**, **Snap Layouts flyouts**, centered **Taskbar**, floating **Start Menu**, **Segoe UI Variable** typography, modern controls (Buttons, Toggle Switches, Sliders, Tab strips, Progress bars), and dynamic Light / Dark theme support.

No JavaScript runtime dependencies required — it works seamlessly with vanilla HTML, React, Next.js, Vue, Svelte, or Angular.

---

## 🚀 Features

- **Fluent 2 Materials**: Authentic Mica (`radial-gradient` + `backdrop-filter: blur(30px) saturate(180%)`) and Acrylic transparency.
- **Windows 11 Windows**: 8px rounded corners, subtle 1px border, 32px title bar, and hover caption controls.
- **Snap Layouts**: Built-in styling for 50/50, 70/30, 4-quadrant, and 3-column window snapping.
- **Modern Controls**:
  - Standard, Accent, and Subtle Buttons with scale micro-interactions.
  - Windows 11 Toggle Switches (`role="switch"` or `.win11-toggle`).
  - Text inputs with active bottom accent underline on focus.
  - Checkboxes and Radio buttons with smooth check states.
  - Fluent Range Sliders with circular thumb and active track filling.
  - Determinate & Indeterminate Progress bars.
  - Modern File Explorer / Notepad Tab strips with active bottom pill.
  - Acrylic Context Menus and Flyouts.
- **System Shell Components**: Centered Taskbar, Floating Start Menu with 6-column grid, Quick Settings Action Center, and Widgets Board.
- **Light & Dark Mode**: Seamless toggle via `data-theme="dark"` or class `.dark`.

---

## 📦 Installation & Usage

### Via npm:

```sh
npm install 11.css
```

Then import the stylesheet in your CSS or JavaScript/TypeScript project:

```javascript
// Import full Windows 11 Fluent styles
import "11.css/dist/11.css";
```

### Via CDN:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Windows 11 Fluent App</title>
  <link rel="stylesheet" href="https://unpkg.com/11.css/dist/11.css" />
</head>
<body>
  <!-- Window Component -->
  <div class="window active" style="width: 480px; margin: 40px auto;">
    <div class="title-bar">
      <div class="title-bar-text">
        <span>Settings</span>
      </div>
      <div class="title-bar-controls">
        <button aria-label="Minimize" title="Minimize">−</button>
        <button aria-label="Maximize" title="Maximize">□</button>
        <button aria-label="Close" class="close" title="Close">✕</button>
      </div>
    </div>
    <div class="window-body">
      <h3>Personalization</h3>
      <p class="text-secondary">Customize colors, background, and theme.</p>
      
      <div style="display: flex; gap: 10px; margin-top: 16px;">
        <button class="accent">Save Changes</button>
        <button>Cancel</button>
        <button class="subtle">Learn More</button>
      </div>
    </div>
  </div>
</body>
</html>
```

---

## 🎨 Design Tokens & Customization

You can effortlessly override CSS variables to tailor your accent color and theme:

```css
:root {
  /* Customize Accent Color (e.g. Purple, Teal, Coral) */
  --w11-accent: #8764b8;
  --w11-accent-hover: #9b79c9;
  --w11-accent-active: #7853aa;

  /* Custom Corner Radius */
  --w11-radius-sm: 4px;
  --w11-radius-lg: 8px;
}
```

### Switching to Dark Mode

Apply `data-theme="dark"` or the class `.dark` to `<html>` or `<body>`:

```html
<body data-theme="dark">
  <!-- All Windows 11 components automatically render in Dark Mica / Acrylic -->
</body>
```

---

## 🧩 Component Cheat Sheet

| Component | HTML / CSS Class | Description |
|---|---|---|
| **Window** | `.window` or `.win11-window` | Rounded Mica window with shadow and border |
| **Title Bar** | `.title-bar` | 32px Fluent title bar with draggable zone |
| **Caption Controls** | `.title-bar-controls button` | Minimize, Maximize, Close buttons |
| **Accent Button** | `button.accent` or `button.primary` | Windows 11 colored action button |
| **Subtle Button** | `button.subtle` | Transparent ghost button with hover tint |
| **Toggle Switch** | `input[type="checkbox"][role="switch"]` | Fluent pill switch with slide animation |
| **Search Box** | `.win11-searchbox` | Search input with embedded icon and focus bar |
| **Range Slider** | `input[type="range"]` | Thin track slider with circular thumb |
| **Tabs** | `[role="tablist"]`, `[role="tab"]` | Fluent tabs with bottom accent indicator |
| **Expander Card** | `details.win11-expander` | Settings-style collapsible card |
| **Context Menu** | `menu` or `.win11-menu` | Acrylic flyout menu with elevation shadow |
| **Progress Bar** | `progress` or `.win11-progressbar` | Determinate / Indeterminate progress |
| **Taskbar** | `.win11-taskbar` | Centered blur taskbar with running app pills |
| **Start Menu** | `.win11-startmenu` | Floating centered acrylic start menu |

---

## 🛠 Developing & Building

```sh
# Install dependencies
npm install

# Build production CSS bundles (dist/11.css, dist/11.scoped.css, dist/11.inline.css)
npm run build
```

---

## 📄 License

MIT License. Designed and built with inspiration from Microsoft Fluent 2 Design System and community open-source projects.

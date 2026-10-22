# Bases Plus

An Obsidian plugin that adds a **Cards Plus** view to Bases: a card layout like the built-in Cards view, as a base for extra features.

Requires Obsidian **1.13.0+** (Bases plugin API + declarative settings).

## Features

**Cards (same as the built-in Cards view)**
- Card size, image property, image fit (cover / contain), image aspect ratio
- The image property accepts `[[attachment.png]]` links, `![](...)` embeds, vault paths, external URLs, and colors (`"#ff8800"`, `rgb(...)`; quote hex values in YAML). For lists, the first item that resolves is used.
- **Fallback image property:** used when the image property is empty, doesn't resolve to an image, or fails to load (e.g. main `localCover`, fallback `cover`).
- Grouping with group headers and counts, property values rendered by Obsidian (links, tags, checkboxes…)
- Click a card to open the note (Ctrl/Cmd-click or middle-click opens it in a new tab), hover the title for a preview, right-click for the file menu

**Extras**
- **Card gap:** spacing between cards, 0–48px (default 12px)
- **Title property:** show a property as the card title instead of the file name (falls back to the file name when empty)
- **Title lines:** clamp card titles to N lines (0 = no limit)
- **Image fills card (show info on hover):** the card is just the image; on hover the title and properties slide up and fade in over a dark overlay (scrollable if taller than the card). Always shown on touch screens and on cards without an image; reduced-motion users get a fade only.
- **Show property labels** toggle
- **Collapsible groups:** click the chevron on a group header. Collapsed groups are remembered per view (saved as `collapsedGroups` in the `.base` file), and renaming a collapsed group keeps it collapsed.
- **Plugin settings** (Settings → Bases Plus):
  - Group header font size
  - Select button placement: *Bases toolbar* (next to Sort / Group / Filter) or *Row above the cards*. The toolbar button is inserted into Obsidian's own toolbar, which has no public API; if a future update changes the toolbar so it can't be found, the button falls back to the row above the cards automatically.
- **Command:** *Bases Plus: Toggle select mode* works on the Cards Plus view in the active tab and can be given a hotkey (Settings → Hotkeys). It uses only the official API, so it keeps working whatever happens to the toolbar.
- **Rename groups:** click a group header to edit it. Enter or clicking away applies, Esc cancels. After you confirm, the group-by property is rewritten in every note in that group (list items matching the old value are replaced; numbers and booleans keep their type). Clicking *No value* sets the property on those notes. Only works when grouping by a note property, not a formula or file property.
- **Select mode** (the *Select* button, the *Toggle select mode* command, or right-click a card → Select):
  - Click to toggle a card, Shift-click to select a range, Esc to exit
  - *Select all* checkbox in the toolbar, and a *Select group* button on each group header when grouping (clicking it also turns on select mode)
  - **Add tags:** adds to `tags`, skipping tags a note already has (case-insensitive)
  - **Set property:** sets `property: value` on every selected note, **overwriting** existing values. Type is Text / List / Number / Checkbox / Date / Date & time, and is guessed from existing values.
  - **Remove properties:** pick from the properties the selected notes have (with counts)
  - **Delete:** asks first, then moves the files to trash using your "Deleted files" setting
  - Right-click a selected card for the same actions, plus other plugins' multi-file menu items

## Project layout

```
src/main.ts                  Plugin entry: registers the view, command and settings tab
src/settings.ts              Plugin settings tab (declarative settings API)
src/image.ts                 Resolves an image property to an image URL or color
src/bulk.ts                  Frontmatter edits: add tags, set/remove properties, rename group, delete
src/modals.ts                Dialogs for the bulk actions

src/views/cards-plus/
  CardsPlusView.ts           The view class: wires the modules below together
  options.ts                 View options (settings menu), defaults, reading the config
  card.ts                    One card: title, properties, click / hover / right-click
  cover.ts                   Card cover image, with fallback property
  groups.ts                  Group headers: collapse, rename, "Select group"
  selection.ts               Select-mode state (no DOM)
  toolbar.ts                 Select button in the Bases toolbar + the bulk-action bar
  bulk-actions.ts            Bulk actions on selected cards (dialog → edit)
styles.css                   View styles (loaded automatically by Obsidian)
manifest.json                Plugin id/name/version (id = folder name in the vault)
esbuild.config.mjs           Bundler; outputs main.js
scripts/install.mjs          Copies main.js, manifest.json, styles.css into a vault
```

## Build

```powershell
npm install          # once
npm run build        # type-check + production bundle -> main.js
npm run dev          # watch mode: rebuilds main.js on every save
npm run lint         # eslint with the official obsidianmd rules
```

## Install into a vault

Use a **separate test vault** for development, not your main vault.

The plugin goes in `<vault>/.obsidian/plugins/bases-plus/` and needs `main.js`, `manifest.json` and `styles.css`.

**One-off install:**

```powershell
npm run build
npm run install-plugin -- "C:\path\to\TestVault"
```

**Dev loop (auto-copy on every rebuild):**

```powershell
$env:OBSIDIAN_VAULT = "C:\path\to\TestVault"
npm run dev
```

Then in Obsidian:

1. Settings → Community plugins → turn off Restricted mode, then enable **Bases Plus**.
2. Open or create a `.base` file → view picker → **Add view** → **Cards Plus**.
3. Use the view's settings (the toolbar menu) to pick an image property, image fit, card size and labels; pick the shown properties in the **Properties** menu.

**Reloading after changes:** run **Reload app without saving** from the command palette. Turning the plugin off and on does not rebuild a Bases view that is already open, so the old view code keeps running. The community plugin **Hot-Reload** (pjeby/hot-reload) can also reload automatically; the install script writes the `.hotreload` file it looks for.

## Release

Bump `version` in `manifest.json` (or run `npm version patch`), then `npm run build`, and attach `main.js`, `manifest.json` and `styles.css` to a GitHub release.

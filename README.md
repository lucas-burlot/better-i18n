<p align="center">
  <img src="res/logo-source.svg" width="120" alt="Better i18n logo">
</p>

<h1 align="center">Better i18n</h1>

<p align="center">
Fast, offline i18n dashboard and inline editor for Vue i18n projects (<code>vue-i18n</code> /
<code>@nuxtjs/i18n</code>). No account, no AI calls, no paywall — everything runs locally
against your own locale files.
</p>

## Table of contents

- [Why](#why)
- [Features](#features)
- [Requirements](#requirements)
- [Configuration](#configuration)
- [Commands](#commands)
- [How it works](#how-it-works)
- [FAQ](#faq)
- [Development](#development)
- [Installing / updating locally](#installing--updating-locally)

## Why

Most i18n editor extensions assume one file per locale. Real projects often split
translations across several files per locale — a shared file plus one per page or
feature, all merged into a single object at runtime. That split is exactly where several
existing tools break down: they infer which physical file "owns" a key from its filename
or folder path instead of from the file's actual content, so editing an *existing*
translation can silently write the change to the wrong file (or even quietly duplicate
the key in the wrong place).

Better i18n resolves file ownership by indexing the real JSON structure of every matched
locale file, not by convention. Editing an existing key always writes back to the file
that actually defines it — and if the same key is ever defined in two files at once, the
dashboard flags it and blocks editing until you resolve the ambiguity yourself, instead of
guessing.

## Features

### Hover with inline editing

Hovering any `t('key')` / `$t('key')` call shows every locale side by side, each editable
in place:

```vue
<p>{{ t('pages.login.title') }}</p>
```

```
pages.login.title

🇫🇷 fr — Bon retour       ✏️ edit
🇬🇧 en — Welcome back     ✏️ edit
```

Clicking **edit** opens an input box pre-filled with the current value; submitting writes
straight to the file that actually defines that key for that locale.

### Inline translation preview

The source-locale translation is appended after the line, in light gray italics — the real
code is never touched, hidden, or made read-only:

```vue
<p>{{ t('pages.login.title') }}</p>  Bon retour
```

Toggle with `betterI18n.inlineTranslations` if you'd rather rely on the hover alone.

### Precise Ctrl+Click / Go to Definition

Most editors treat `.` as a word boundary, so Ctrl+Click on a dotted key like
`pages.login.error` only ever selects one segment (`pages`, or `login`, or `error`).
Better i18n overrides that: Ctrl+Click anywhere inside the key jumps to the exact line, in
the exact file, that defines the whole key — `pages.login.error`, not a fragment of it.

### Dashboard

An activity bar view reporting, per locale:

- **Completion %** — translated keys vs. the source locale's key set.
- **Missing keys** — present in the source locale, absent or empty elsewhere.
- **Unused keys** — defined in locale files but never referenced in code.
- **Duplicate keys** — the same path defined in two files for the same locale. Editing is
  blocked on these until you fix the duplicate by hand, since there's no safe automatic
  choice of which file should win.

## Requirements

- A Vue project using `vue-i18n` or `@nuxtjs/i18n`.
- Locale files as plain JSON (comments/JSONC are not supported), one object per locale,
  merged at runtime by your i18n setup.
- Code that references keys as `t('some.key')` or `$t('some.key')`.

## Configuration

All paths are globs relative to the workspace root.

| Setting | Default | Description |
| --- | --- | --- |
| `betterI18n.localesGlob` | `apps/frontend/i18n/locales/**/*.json` | Matches every locale JSON file. |
| `betterI18n.sourceLocale` | `fr` | Reference locale: completion % and missing-key detection are computed against its key set. |
| `betterI18n.codeGlobs` | `["apps/frontend/app/**/*.{vue,ts}", "apps/frontend/stories/**/*.{vue,ts}"]` | Scanned for `t()`/`$t()` key usages (drives the "unused keys" report). |
| `betterI18n.inlineTranslations` | `true` | Show the source-locale translation after each `t('key')` call. Requires a window reload to take effect. |

The defaults target a specific monorepo layout (`apps/frontend/...`) — override
`betterI18n.localesGlob` and `betterI18n.codeGlobs` in your workspace settings to match
your own project structure.

## Commands

| Command | Purpose |
| --- | --- |
| **Better i18n: Refresh** | Rebuilds the locale/usage index and the dashboard. Runs automatically on file changes; use this if something looks stale. |
| **Better i18n: Edit Translation** | Used internally by the hover's "edit" links. |
| **Better i18n: Reveal Key** | Used internally by the dashboard's key lists to jump to a key's defining file and line. |

## How it works

On activation (and whenever a matched file changes), Better i18n:

1. Scans every file matching `betterI18n.localesGlob`, parses it as JSON, and flattens it
   into `locale → dotted key path → { file, value }` — the locale itself comes from the
   filename (e.g. `fr.json` → `fr`), everything else comes from walking the real object
   structure, not a naming convention.
2. Scans every file matching `betterI18n.codeGlobs` for `t('key')` / `$t('key')` calls to
   build a usage index, used for the "unused keys" report.
3. Renders the dashboard and inline decorations from those two indexes.

Writing a translation looks up the key's existing entry and writes back to that exact
file and JSON path. For a key that's missing only in one locale, it reuses the source
locale's directory and swaps the filename (e.g. `pages/login/fr.json` →
`pages/login/en.json`), creating the sibling file if it doesn't exist yet. If a key
resolves to more than one file for the same locale, editing is refused rather than
guessing which one to write to.

## FAQ

**Does it need an account or an internet connection?**
No. Everything — reading, editing, the dashboard — runs against local files only.

**Does it call any AI or translation service?**
No. There's no AI-assisted extraction, suggestion, or auto-translation here — it's a
straightforward reader/editor for files you already maintain by hand.

**My project doesn't use the `apps/frontend/...` layout — can I still use this?**
Yes, override `betterI18n.localesGlob` and `betterI18n.codeGlobs` in your workspace
settings (see [Configuration](#configuration)).

**What happens if a key exists in two files for the same locale?**
The dashboard lists it under duplicates and editing that key is blocked until you remove
the duplicate — there's no reliable way to guess which copy you meant.

## Development

```bash
pnpm install
pnpm run build      # bundle dist/extension.js via esbuild
pnpm run watch      # rebuild continuously
pnpm run typecheck
```

## Installing / updating locally

Not published to a marketplace — packaged as a `.vsix` and installed through the CLI,
explicitly targeting the Cursor/VS Code profile you actually use. Installing without a
profile flag installs into the *default* profile, which stays invisible from a window
running a named profile:

```bash
pnpm run package
cursor --profile "<your-profile-name>" --install-extension better-i18n.vsix
# code --profile "<your-profile-name>" --install-extension better-i18n.vsix   # VS Code
```

Then `Developer: Reload Window`. Repeat both commands after any change under `src/`.

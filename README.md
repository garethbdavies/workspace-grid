# Workspace Grid

Open terminals or AI chat panels in a configurable grid layout with a single command.

## Commands

| Command | Description |
|---|---|
| `Workspace Grid: Open Terminal Grid` | Opens terminals in a rows x columns grid |
| `Workspace Grid: Open Chat Grid` | Opens AI chat panels in a grid |

Both commands close all existing editors and terminals first, then build the grid fresh.

## Configuration

All settings are under the `workspace-grid` prefix in your `settings.json`.

### Terminal Grid

```json
"workspace-grid.rows": 2,
"workspace-grid.columns": 4,
"workspace-grid.terminals": [
  { "name": "D.A.R.Y.L.",      "command": "", "icon": "server",   "color": "terminal.ansiGreen"   },
  { "name": "ROBOCOP",        "command": "", "icon": "git-merge","color": "terminal.ansiYellow"  },
  { "name": "HAL 9000",        "command": "", "icon": "beaker",   "color": "terminal.ansiCyan"    },
  { "name": "R2D2",            "command": "", "icon": "terminal", "color": "terminal.ansiWhite"   },
  { "name": "OPTIMUS PRIME",   "command": "", "icon": "package",  "color": "terminal.ansiMagenta" },
  { "name": "MARVIN",          "command": "", "icon": "output",   "color": "terminal.ansiBlue"    },
  { "name": "LCDR DATA",       "command": "", "icon": "vm",       "color": "terminal.ansiRed"     },
  { "name": "JOHNNY 5",        "command": "", "icon": "terminal", "color": "terminal.ansiGreen"   }
]
```

Terminals are assigned in row-major order: R1C1, R1C2 ... R1CN, R2C1 ... You can define more entries than `rows * columns` - extras are pre-configured and used if you increase the grid size later.

### Terminal options

| Property | Type | Description |
|---|---|---|
| `name` | string | Tab label |
| `command` | string | Shell command sent on open |
| `icon` | string | [Codicon](https://microsoft.github.io/vscode-codicons/dist/codicon.html) name (e.g. `terminal`, `server`, `database`) |
| `color` | string | Theme color ID (e.g. `terminal.ansiGreen`, `terminal.ansiYellow`) |

### Chat Grid

Use separate dimensions for the chat grid - it defaults to `rows`/`columns` if not set.

Works with any AI extension that registers a command to open a new chat panel (Claude Code, GitHub Copilot, Cursor, etc.).

```json
"workspace-grid.chatRows": 2,
"workspace-grid.chatColumns": 4,
"workspace-grid.chatCommand": "claude-vscode.editor.open"
```

To find the correct `chatCommand` ID: open the Command Palette, hover over the AI chat command for your extension, and copy its ID.

### All settings

| Setting | Default | Description |
|---|---|---|
| `workspace-grid.rows` | `2` | Rows in the terminal grid |
| `workspace-grid.columns` | `4` | Columns in the terminal grid |
| `workspace-grid.terminals` | `[]` | Terminal configs in row-major order |
| `workspace-grid.chatRows` | _(uses rows)_ | Rows in the chat grid |
| `workspace-grid.chatColumns` | _(uses columns)_ | Columns in the chat grid |
| `workspace-grid.chatCommand` | `claude-vscode.editor.open` | VS Code command ID to open a new AI chat panel |

## License

[CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/) - free to use and adapt with attribution, not for commercial use or resale.

Copyright (c) 2026 Gareth B. Davies

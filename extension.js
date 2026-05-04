'use strict';

const vscode = require('vscode');

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Builds the setEditorLayout argument for a cols x rows grid.
// Returns null for 1x1 (no layout change needed).
function buildLayout(cols, rows) {
    if (cols === 1 && rows === 1) return null;
    if (cols === 1) {
        return { orientation: 1, groups: Array.from({ length: rows }, () => ({})) };
    }
    const makeGroup = () => rows > 1
        ? { orientation: 1, groups: Array.from({ length: rows }, () => ({})), size: 1 / cols }
        : { size: 1 / cols };
    return { orientation: 0, groups: Array.from({ length: cols }, makeGroup) };
}

// Returns the viewColumn for cell i in row-major order.
// VS Code numbers editor groups by DFS: col0-row0=1, col0-row1=2, ... col1-row0=rows+1, ...
// Row-major cell i: row = floor(i/cols), col = i%cols -> viewCol = col*rows + row + 1
function viewColFor(i, cols, rows) {
    const row = Math.floor(i / cols);
    const col = i % cols;
    return col * rows + row + 1;
}

async function setupGrid() {
    const cfg = vscode.workspace.getConfiguration('workspace-grid');
    const rows = Math.max(1, Math.min(6, cfg.get('rows') ?? 2));
    const cols = Math.max(1, Math.min(6, cfg.get('columns') ?? 4));

    // Suppress the "terminate process?" popup while disposing terminals
    const termCfg = vscode.workspace.getConfiguration('terminal.integrated');
    const prevConfirmOnKill = termCfg.get('confirmOnKill');
    await termCfg.update('confirmOnKill', 'never', vscode.ConfigurationTarget.Global);

    for (const t of vscode.window.terminals) t.dispose();
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    await delay(500);

    await termCfg.update('confirmOnKill', prevConfirmOnKill, vscode.ConfigurationTarget.Global);

    const layout = buildLayout(cols, rows);
    if (layout) {
        await vscode.commands.executeCommand('vscode.setEditorLayout', layout);
        await delay(500);
    }

    return { rows, cols, cfg };
}

async function openTerminalGrid() {
    const { rows, cols, cfg } = await setupGrid();
    const terminalConfigs = cfg.get('terminals') || [];
    const total = rows * cols;

    for (let i = 0; i < total; i++) {
        const tcfg = terminalConfigs[i] || {};
        const t = vscode.window.createTerminal({
            name: tcfg.name || `T${i + 1}`,
            iconPath: tcfg.icon ? new vscode.ThemeIcon(tcfg.icon) : undefined,
            color: tcfg.color ? new vscode.ThemeColor(tcfg.color) : undefined,
            location: { viewColumn: viewColFor(i, cols, rows), preserveFocus: true }
        });
        if (tcfg.command) {
            await delay(300);
            t.sendText(tcfg.command);
        }
        await delay(150);
    }

    await vscode.commands.executeCommand('workbench.action.focusFirstEditorGroup');
}

async function openChatGrid() {
    const cfg = vscode.workspace.getConfiguration('workspace-grid');
    const rows = Math.max(1, Math.min(6, cfg.get('chatRows') ?? cfg.get('rows') ?? 2));
    const cols = Math.max(1, Math.min(6, cfg.get('chatColumns') ?? cfg.get('columns') ?? 4));

    const termCfg = vscode.workspace.getConfiguration('terminal.integrated');
    const prevConfirmOnKill = termCfg.get('confirmOnKill');
    await termCfg.update('confirmOnKill', 'never', vscode.ConfigurationTarget.Global);
    for (const t of vscode.window.terminals) t.dispose();
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    await delay(500);
    await termCfg.update('confirmOnKill', prevConfirmOnKill, vscode.ConfigurationTarget.Global);

    const layout = buildLayout(cols, rows);
    if (layout) {
        await vscode.commands.executeCommand('vscode.setEditorLayout', layout);
        await delay(500);
    }

    const chatCommand = cfg.get('chatCommand') || 'claude-vscode.editor.open';
    const total = rows * cols;

    // Phase 1: open all chats. claude-vscode.editor.open always opens in group 1
    // regardless of which group is focused, so they accumulate as tabs there
    // (C1..CN, left=oldest, right=newest, newest is active).
    await vscode.commands.executeCommand('workbench.action.focusFirstEditorGroup');
    await delay(200);

    let opened = 0;
    for (let i = 0; i < total; i++) {
        try {
            await vscode.commands.executeCommand(chatCommand);
            await delay(700);
            opened++;
        } catch {
            vscode.window.showWarningMessage(
                `Workspace Grid: command "${chatCommand}" failed. ` +
                `Update workspace-grid.chatCommand in settings with the correct command ID.`
            );
            break;
        }
    }

    // Phase 2: distribute chats from group 1 to groups 2, 3, ..., opened.
    // We process in ASCENDING group order so every intermediate group already
    // holds a chat when we pass through it. This means no group ever hits zero
    // editors and VS Code never collapses the layout.
    //
    // Each iteration: return focus to group 1 (its active tab is the
    // most-recently-opened remaining chat), then walk it right to targetGroup.
    // After the active tab leaves group 1, VS Code activates the next-rightmost
    // tab there automatically, ready for the next iteration.
    for (let targetGroup = 2; targetGroup <= opened; targetGroup++) {
        await vscode.commands.executeCommand('workbench.action.focusFirstEditorGroup');
        await delay(250);

        for (let m = 0; m < targetGroup - 1; m++) {
            await vscode.commands.executeCommand('workbench.action.moveEditorToNextGroup');
            await delay(200);
        }
    }

    await vscode.commands.executeCommand('workbench.action.focusFirstEditorGroup');
}

function activate(context) {
    context.subscriptions.push(
        vscode.commands.registerCommand('workspace-grid.openTerminalGrid', () => {
            openTerminalGrid().catch(err =>
                vscode.window.showErrorMessage(`Workspace Grid: ${err.message}`)
            );
        }),
        vscode.commands.registerCommand('workspace-grid.openChatGrid', () => {
            openChatGrid().catch(err =>
                vscode.window.showErrorMessage(`Workspace Grid: ${err.message}`)
            );
        })
    );
}

function deactivate() {}

module.exports = { activate, deactivate };

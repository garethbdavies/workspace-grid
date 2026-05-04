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

    // Phase 2: distribute chats from their source group to all other groups.
    // Different AI extensions open in different groups (some use group 1, some
    // use the last group), so we detect the source by finding which group has
    // the most tabs after Phase 1.
    //
    // We process in the direction that keeps every intermediate group populated,
    // so no group ever hits zero editors and VS Code never collapses the layout.
    //   Source = group 1   -> distribute forward  (ascending:  2, 3, ..., N)
    //   Source = last group -> distribute backward (descending: N-1, N-2, ..., 1)
    await delay(300);
    const allGroups = vscode.window.tabGroups.all;
    let sourceGroupIdx = 0;
    let maxTabs = 0;
    for (let g = 0; g < allGroups.length; g++) {
        if (allGroups[g].tabs.length > maxTabs) {
            maxTabs = allGroups[g].tabs.length;
            sourceGroupIdx = g;
        }
    }
    const sourceGroup = sourceGroupIdx + 1; // 1-indexed DFS

    const focusCmds = [
        'workbench.action.focusFirstEditorGroup',
        'workbench.action.focusSecondEditorGroup',
        'workbench.action.focusThirdEditorGroup',
        'workbench.action.focusFourthEditorGroup',
        'workbench.action.focusFifthEditorGroup',
        'workbench.action.focusSixthEditorGroup',
        'workbench.action.focusSeventhEditorGroup',
        'workbench.action.focusEighthEditorGroup',
    ];
    const focusSource = focusCmds[sourceGroupIdx];

    if (sourceGroup === 1) {
        // Distribute forward: move chats from group 1 to groups 2, 3, ..., N
        for (let target = 2; target <= opened; target++) {
            await vscode.commands.executeCommand(focusSource);
            await delay(250);
            for (let m = 0; m < target - 1; m++) {
                await vscode.commands.executeCommand('workbench.action.moveEditorToNextGroup');
                await delay(200);
            }
        }
    } else {
        // Distribute backward: move chats from sourceGroup to groups N-1, N-2, ..., 1
        for (let target = sourceGroup - 1; target >= 1; target--) {
            await vscode.commands.executeCommand(focusSource);
            await delay(250);
            const moves = sourceGroup - target;
            for (let m = 0; m < moves; m++) {
                await vscode.commands.executeCommand('workbench.action.moveEditorToPreviousGroup');
                await delay(200);
            }
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

import { SetValueCommand } from '@/engine/editor/commands/set-value-command';
import type { Command } from '@/engine/editor/history/command';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import { clampAreaCost, isBuiltInArea, sanitizeAreaName, type NavArea } from '@/engine/navigation/areas/nav-areas';
function areaCommand(session: EditorSession, area: number, label: string, next: NavArea, mergeKey?: string): Command {
    const { areas } = session.scene.navigation;
    return new SetValueCommand<NavArea>(label, (value) => {
        areas[area] = value;
    }, areas[area], next, mergeKey);
}
export function setNavAreaName(session: EditorSession, area: number, name: string): void {
    const current = session.scene.navigation.areas[area];
    if (!current || isBuiltInArea(area))
        return;
    const sanitized = sanitizeAreaName(area, name);
    if (sanitized !== current.name)
        session.history.execute(areaCommand(session, area, `Renomear área de navegação para ${sanitized}`, { ...current, name: sanitized }));
}
export function setNavAreaCost(session: EditorSession, area: number, cost: number): void {
    const current = session.scene.navigation.areas[area];
    if (!current || !Number.isFinite(cost))
        return;
    const clamped = clampAreaCost(cost);
    if (clamped !== current.cost)
        session.history.execute(areaCommand(session, area, `Custo da área ${current.name}`, { ...current, cost: clamped }, `navArea:${area}:cost`));
}

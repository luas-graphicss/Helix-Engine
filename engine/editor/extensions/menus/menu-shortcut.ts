import { eventChord } from '../shortcuts/shortcut-chord';
import type { MenuContribution, MenuTarget } from './menu-contribution';
export function findMenuByShortcut(contributions: readonly MenuContribution[], event: KeyboardEvent, target: MenuTarget): MenuContribution | null {
    const chord = eventChord(event);
    if (chord === null)
        return null;
    return contributions.find((contribution) => contribution.shortcut === chord && contribution.isEnabled(target)) ?? null;
}

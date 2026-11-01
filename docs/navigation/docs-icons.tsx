import { Aperture, AppWindow, Atom, AudioLines, BookOpen, Boxes, Braces, Code2, Compass, Cpu, FolderOpen, Gamepad2, GraduationCap, Hammer, LayoutPanelTop, type LucideIcon, Mountain, Package, PersonStanding, Rocket, Settings2, Sparkles, Sun, Wand2, Wrench, } from 'lucide-react';
export const DOCS_ICONS = {
    book: BookOpen,
    graduation: GraduationCap,
    braces: Braces,
    compass: Compass,
    layout: LayoutPanelTop,
    settings: Settings2,
    boxes: Boxes,
    sun: Sun,
    atom: Atom,
    mountain: Mountain,
    person: PersonStanding,
    window: AppWindow,
    audio: AudioLines,
    sparkles: Sparkles,
    folder: FolderOpen,
    code: Code2,
    package: Package,
    rocket: Rocket,
    hammer: Hammer,
    wand: Wand2,
    cpu: Cpu,
    aperture: Aperture,
    gamepad: Gamepad2,
    wrench: Wrench,
} satisfies Record<string, LucideIcon>;
export type DocsIconId = keyof typeof DOCS_ICONS;
export function DocsIcon({ id, className }: {
    id: DocsIconId;
    className?: string;
}) {
    const Icon = DOCS_ICONS[id];
    return <Icon aria-hidden className={className}/>;
}

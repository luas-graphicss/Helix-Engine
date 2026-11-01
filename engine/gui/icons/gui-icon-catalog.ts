type IconAttributes = Record<string, string | number>;
type IconNode = ReadonlyArray<readonly [
    string,
    IconAttributes
]>;
type Listener = () => void;
interface CompiledIcon {
    readonly paths: Path2D[];
    readonly fills: Path2D[];
}
export class GuiIconCatalog {
    private icons: Record<string, IconNode> | null = null;
    private loading: Promise<void> | null = null;
    private readonly compiled = new Map<string, CompiledIcon>();
    private readonly listeners = new Set<Listener>();
    subscribe = (listener: Listener): (() => void) => {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    };
    get ready(): boolean {
        return this.icons !== null;
    }
    load(): Promise<void> {
        if (this.icons)
            return Promise.resolve();
        if (!this.loading) {
            this.loading = import('lucide')
                .then((module) => {
                this.icons = module.icons as unknown as Record<string, IconNode>;
                for (const listener of this.listeners)
                    listener();
            })
                .catch(() => {
                this.loading = null;
            });
        }
        return this.loading;
    }
    names(): string[] {
        return this.icons ? Object.keys(this.icons) : [];
    }
    has(name: string): boolean {
        return this.icons !== null && name in this.icons;
    }
    search(query: string, limit = 160): string[] {
        const names = this.names();
        const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
        if (terms.length === 0)
            return names.slice(0, limit);
        const matches: Array<{
            name: string;
            score: number;
        }> = [];
        for (const name of names) {
            const haystack = iconLabel(name).toLowerCase();
            let score = 0;
            for (const term of terms) {
                const at = haystack.indexOf(term);
                if (at === -1) {
                    score = -1;
                    break;
                }
                score += at === 0 ? 3 : haystack[at - 1] === ' ' ? 2 : 1;
            }
            if (score > 0)
                matches.push({ name, score });
        }
        return matches
            .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
            .slice(0, limit)
            .map((match) => match.name);
    }
    compile(name: string): CompiledIcon | null {
        const cached = this.compiled.get(name);
        if (cached)
            return cached;
        const node = this.icons?.[name];
        if (!node) {
            void this.load();
            return null;
        }
        const paths: Path2D[] = [];
        const fills: Path2D[] = [];
        for (const [tag, attributes] of node) {
            const path = new Path2D();
            const number = (key: string) => Number(attributes[key] ?? 0);
            switch (tag) {
                case 'path':
                    paths.push(new Path2D(String(attributes.d ?? '')));
                    continue;
                case 'circle':
                    path.arc(number('cx'), number('cy'), number('r'), 0, Math.PI * 2);
                    break;
                case 'ellipse':
                    path.ellipse(number('cx'), number('cy'), number('rx'), number('ry'), 0, 0, Math.PI * 2);
                    break;
                case 'rect': {
                    const rx = number('rx');
                    if (rx > 0)
                        path.roundRect(number('x'), number('y'), number('width'), number('height'), rx);
                    else
                        path.rect(number('x'), number('y'), number('width'), number('height'));
                    break;
                }
                case 'line':
                    path.moveTo(number('x1'), number('y1'));
                    path.lineTo(number('x2'), number('y2'));
                    break;
                case 'polyline':
                case 'polygon': {
                    const points = String(attributes.points ?? '')
                        .trim()
                        .split(/[\s,]+/)
                        .map(Number);
                    for (let index = 0; index + 1 < points.length; index += 2) {
                        if (index === 0)
                            path.moveTo(points[index], points[index + 1]);
                        else
                            path.lineTo(points[index], points[index + 1]);
                    }
                    if (tag === 'polygon')
                        path.closePath();
                    break;
                }
                default:
                    continue;
            }
            if (attributes.fill && attributes.fill !== 'none')
                fills.push(path);
            else
                paths.push(path);
        }
        const compiled = { paths, fills };
        this.compiled.set(name, compiled);
        return compiled;
    }
    draw(context: CanvasRenderingContext2D, name: string, x: number, y: number, side: number, color: string, strokeWidth: number): boolean {
        const compiled = this.compile(name);
        if (!compiled)
            return false;
        const scale = side / 24;
        context.save();
        context.translate(x, y);
        context.scale(scale, scale);
        context.lineCap = 'round';
        context.lineJoin = 'round';
        context.lineWidth = strokeWidth;
        context.strokeStyle = color;
        context.fillStyle = color;
        for (const path of compiled.paths)
            context.stroke(path);
        for (const path of compiled.fills)
            context.fill(path);
        context.restore();
        return true;
    }
}
export function iconLabel(name: string): string {
    return name.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z])([A-Z][a-z])/g, '$1 $2');
}
export const guiIcons = new GuiIconCatalog();
export const GUI_ICON_SUGGESTIONS: readonly string[] = [
    'Play',
    'Pause',
    'Square',
    'Settings',
    'Heart',
    'Shield',
    'Sword',
    'Swords',
    'Star',
    'Trophy',
    'Crown',
    'Gem',
    'Coins',
    'Backpack',
    'Map',
    'MapPin',
    'Compass',
    'Target',
    'Crosshair',
    'Zap',
    'Flame',
    'Snowflake',
    'Skull',
    'Ghost',
    'Bot',
    'User',
    'Users',
    'MessageCircle',
    'Mail',
    'Bell',
    'Volume2',
    'VolumeX',
    'Music',
    'Gamepad2',
    'Joystick',
    'Keyboard',
    'Mouse',
    'Smartphone',
    'Lock',
    'Unlock',
    'Key',
    'Check',
    'X',
    'Plus',
    'Minus',
    'ChevronLeft',
    'ChevronRight',
    'ChevronUp',
    'ChevronDown',
    'ArrowLeft',
    'ArrowRight',
    'RotateCcw',
    'RefreshCw',
    'Home',
    'Menu',
    'Search',
    'Filter',
    'Info',
    'CircleAlert',
    'TriangleAlert',
    'CircleHelp',
    'Clock',
    'Timer',
    'Hourglass',
    'Sun',
    'Moon',
    'Cloud',
    'Package',
    'Gift',
    'ShoppingCart',
    'Wallet',
    'Pickaxe',
    'Hammer',
    'Wrench',
    'Axe',
    'Wand',
    'Sparkles',
    'Rocket',
    'Car',
    'Plane',
    'Ship',
    'Anchor',
    'Trees',
    'Mountain',
    'Tent',
    'Castle',
    'Flag',
    'Award',
    'Medal',
    'Dices',
    'Puzzle',
    'Camera',
    'Image',
    'Video',
    'Download',
    'Upload',
    'Save',
    'Trash2',
    'Pencil',
    'Copy',
    'LogOut',
    'Power',
];

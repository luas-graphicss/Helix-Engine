import { Film, Image, Minus, MousePointerClick, RectangleHorizontal, ScrollText, SlidersHorizontal, Square, Star, TextCursorInput, ToggleRight, Type, Video, type LucideIcon } from 'lucide-react';
import type { GuiElementKind } from '@/engine/gui/document/gui-document';
export const GUI_ELEMENT_ICONS: Record<GuiElementKind, LucideIcon> = {
    frame: Square,
    text: Type,
    image: Image,
    icon: Star,
    button: MousePointerClick,
    toggle: ToggleRight,
    slider: SlidersHorizontal,
    progress: RectangleHorizontal,
    input: TextCursorInput,
    scroll: ScrollText,
    divider: Minus,
    video: Film,
    viewport: Video,
};

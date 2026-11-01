import type { FigureScene } from './figure-scene';
import { CONCEITOS_FIGURES } from './scenes/conceitos';
import { MATEMATICA_FIGURES } from './scenes/matematica';
import { VIEWPORT_FIGURES } from './scenes/viewport';
export const FIGURE_SCENES: readonly FigureScene[] = [...CONCEITOS_FIGURES, ...VIEWPORT_FIGURES, ...MATEMATICA_FIGURES];
export function findFigureScene(id: string): FigureScene | null {
    return FIGURE_SCENES.find((scene) => scene.id === id) ?? null;
}

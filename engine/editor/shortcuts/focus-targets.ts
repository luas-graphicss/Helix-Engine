export const INSPECTOR_NAME_INPUT_ID = 'inspector-entity-name';
export const GUI_ELEMENT_NAME_INPUT_ID = 'inspector-gui-element-name';
function focusAndSelect(id: string): void {
    const input = document.getElementById(id);
    if (input instanceof HTMLInputElement) {
        input.focus();
        input.select();
    }
}
export function focusInspectorName(): void {
    focusAndSelect(INSPECTOR_NAME_INPUT_ID);
}
export function focusGuiElementName(): void {
    focusAndSelect(GUI_ELEMENT_NAME_INPUT_ID);
}
export const COMMAND_BAR_INPUT_ID = 'code-command-bar-input';
export function focusCommandBar(): boolean {
    const input = document.getElementById(COMMAND_BAR_INPUT_ID);
    if (!(input instanceof HTMLInputElement))
        return false;
    input.focus();
    return true;
}

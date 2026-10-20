export const INSPECTOR_NAME_INPUT_ID = 'inspector-entity-name';
export function focusInspectorName(): void {
    const input = document.getElementById(INSPECTOR_NAME_INPUT_ID);
    if (input instanceof HTMLInputElement) {
        input.focus();
        input.select();
    }
}

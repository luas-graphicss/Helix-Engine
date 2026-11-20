import type { KeyboardEvent } from 'react';
const IME_KEY_CODE = 229;
export function blurOnEnter(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'Enter' && !event.nativeEvent.isComposing && event.nativeEvent.keyCode !== IME_KEY_CODE)
        event.currentTarget.blur();
}

import { ANY_KEY, KEYBOARD_CONTROLS } from '../../controls/device-layouts';
import { InputDevice } from '../input-device';
import type { DeviceSource, SourceContext } from './device-source';
export class KeyboardSource implements DeviceSource {
    private readonly device = new InputDevice({ id: 'keyboard', layout: 'Keyboard', name: 'Teclado', controls: KEYBOARD_CONTROLS });
    private readonly held = new Set<string>();
    attach({ registry, signal, acceptsKeyboard }: SourceContext): void {
        registry.add(this.device);
        window.addEventListener('keydown', (event) => {
            if (!event.repeat && event.code !== '' && acceptsKeyboard())
                this.press(event.code);
        }, { capture: true, signal });
        window.addEventListener('keyup', (event) => this.lift(event.code), { capture: true, signal });
        window.addEventListener('blur', () => this.liftAll(), { signal });
    }
    private press(code: string): void {
        this.held.add(code);
        this.device.write(code, 1);
        this.device.write(ANY_KEY, 1);
    }
    private lift(code: string): void {
        this.held.delete(code);
        this.device.write(code, 0);
        this.device.write(ANY_KEY, this.held.size > 0 ? 1 : 0);
    }
    private liftAll(): void {
        this.held.clear();
        this.device.release();
    }
}

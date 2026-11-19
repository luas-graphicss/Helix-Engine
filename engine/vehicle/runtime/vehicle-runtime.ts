import type { Scene } from '@/engine/core/scene/scene';
import type { PhysicsScene } from '@/engine/physics/scene/physics-scene';
import type { PerspectiveCamera } from '@/engine/renderer/camera/perspective-camera';
import { ChaseCamera } from '../camera/chase-camera';
import { KeyboardDriver } from '../input/keyboard-driver';
import { clearVehicleInput } from '../input/vehicle-input';
import type { VehicleInstance } from './vehicle-instance';
import { VehicleSystem } from './vehicle-system';
export interface VehicleRuntimeOptions {
    readonly canvas: HTMLCanvasElement | null;
    readonly camera: PerspectiveCamera;
}
export class VehicleRuntime {
    readonly system: VehicleSystem;
    driven: VehicleInstance | null = null;
    private keyboard: KeyboardDriver | null = null;
    private readonly chase: ChaseCamera;
    constructor(scene: Scene, physics: PhysicsScene, private readonly options: VehicleRuntimeOptions) {
        this.system = new VehicleSystem(scene, physics);
        this.chase = new ChaseCamera(options.camera);
    }
    get isPlayerDriving(): boolean {
        return this.keyboard !== null && this.driven !== null;
    }
    reconcile(): void {
        this.system.reconcile();
        const driven = this.system.instances.find((instance) => instance.entity.vehicle?.control === 'player') ?? null;
        if (driven === this.driven)
            return;
        if (this.driven)
            clearVehicleInput(this.driven.input);
        this.driven = driven;
    }
    applyInput(playerMayDrive: boolean): void {
        const { driven } = this;
        if (!driven || !playerMayDrive || !this.options.canvas) {
            this.releaseKeyboard();
            return;
        }
        this.keyboard ??= new KeyboardDriver();
        this.keyboard.read(driven.input);
    }
    present(deltaSeconds: number): void {
        this.system.present();
        if (this.driven && this.keyboard)
            this.chase.follow(this.driven, deltaSeconds);
    }
    dispose(): void {
        this.releaseKeyboard();
        this.system.dispose();
        this.driven = null;
    }
    private releaseKeyboard(): void {
        if (!this.keyboard)
            return;
        this.keyboard.dispose();
        this.keyboard = null;
        if (this.driven)
            clearVehicleInput(this.driven.input);
    }
}

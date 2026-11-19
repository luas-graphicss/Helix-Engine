import type { Entity } from '@/engine/core/scene/entity';
import type { Scene } from '@/engine/core/scene/scene';
import type { PhysicsScene } from '@/engine/physics/scene/physics-scene';
import { GroundProbe } from '../ground/ground-probe';
import { VehicleInstance } from './vehicle-instance';
import { writeWheelPose } from './wheel-pose';
export class VehicleSystem {
    readonly instances: VehicleInstance[] = [];
    private readonly probe: GroundProbe;
    private readonly removeHook: () => void;
    private readonly wheelEntities: Entity[] = [];
    constructor(private readonly scene: Scene, private readonly physics: PhysicsScene) {
        this.probe = new GroundProbe(physics.world);
        this.removeHook = physics.world.addPreStepHook((deltaSeconds) => {
            for (const instance of this.instances)
                instance.step(deltaSeconds);
        });
    }
    instanceOf(entity: Entity): VehicleInstance | null {
        return this.instances.find((instance) => instance.entity === entity) ?? null;
    }
    reconcile(): void {
        this.dropStaleInstances();
        const { entities } = this.scene;
        for (let index = 0; index < entities.length; index++) {
            const entity = entities[index];
            if (entity.vehicle && !this.instanceOf(entity))
                this.createInstance(entity);
        }
        for (const instance of this.instances) {
            this.wheelEntities.length = 0;
            this.collectWheels(instance.entity);
            instance.syncWheels(this.wheelEntities);
        }
    }
    present(): void {
        for (const instance of this.instances)
            for (const wheel of instance.wheels)
                writeWheelPose(wheel);
    }
    dispose(): void {
        this.removeHook();
        for (const instance of this.instances)
            instance.restoreWheels();
        this.instances.length = 0;
    }
    private dropStaleInstances(): void {
        const { instances, scene, physics } = this;
        for (let index = instances.length - 1; index >= 0; index--) {
            const instance = instances[index];
            const { entity } = instance;
            if (entity.vehicle && scene.root.contains(entity) && physics.bindingOf(entity)?.body === instance.body)
                continue;
            instance.restoreWheels();
            instances.splice(index, 1);
        }
    }
    private createInstance(entity: Entity): void {
        const binding = this.physics.ensureBinding(entity);
        if (!binding?.body.isDynamic)
            return;
        this.scene.updateWorldMatrices();
        this.instances.push(new VehicleInstance(entity, binding.body, this.physics.world, this.probe));
    }
    private collectWheels(parent: Entity): void {
        for (const child of parent.children) {
            if (child.vehicle)
                continue;
            if (child.wheel)
                this.wheelEntities.push(child);
            this.collectWheels(child);
        }
    }
}

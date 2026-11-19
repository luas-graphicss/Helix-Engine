import * as vec3 from '@/engine/core/math/vec3';
import { Scene } from '@/engine/core/scene/scene';
import { createRigidBodySettings } from '@/engine/physics/body/rigid-body-settings';
import { PhysicsScene } from '@/engine/physics/scene/physics-scene';
import { createBox } from '@/engine/renderer/geometry/primitives';
import { assembleVehicle, vehicleRestHeight } from '@/engine/vehicle/assembly/vehicle-assembly';
import { clearVehicleInput } from '@/engine/vehicle/input/vehicle-input';
import { VehicleSystem } from '@/engine/vehicle/runtime/vehicle-system';
import { getVehiclePreset, VEHICLE_PRESETS, type VehiclePreset, type VehiclePresetId } from '@/engine/vehicle/vehicle-presets';
import { createCheckList } from '../support/check-list';
const STEP = 1 / 60;
const UNIT_Y = vec3.create(0, 1, 0);
const UNIT_Z = vec3.create(0, 0, 1);
const LAUNCH_SPEED: Record<VehiclePresetId, number> = { car: 12, offroad: 10, truck: 5, kart: 9 };
const checks = createCheckList('Veículos prontos do menu');
const up = vec3.create();
const heading = vec3.create();
function testPreset(preset: VehiclePreset): void {
    const scene = new Scene(preset.id);
    const ground = scene.createEntity({ name: 'ground', kind: 'mesh', mesh: createBox(800, 1, 800), rigidBody: createRigidBodySettings({ type: 'static', collider: 'box', boxSize: vec3.create(800, 1, 800) }) });
    ground.transform.position[1] = -0.5;
    const restHeight = vehicleRestHeight(preset.blueprint);
    const chassis = assembleVehicle(scene, preset);
    chassis.transform.position[1] = restHeight;
    scene.root.add(chassis);
    const physics = new PhysicsScene(scene);
    const system = new VehicleSystem(scene, physics);
    const advance = (seconds: number): void => {
        for (let step = 0; step < Math.round(seconds / STEP); step++) {
            system.reconcile();
            physics.update(STEP);
            system.present();
        }
    };
    advance(2);
    const vehicle = system.instanceOf(chassis);
    if (!vehicle)
        throw new Error(`Preset "${preset.id}" produced no vehicle instance`);
    const uprightness = (): number => vehicle.body.localDirectionToWorld(up, UNIT_Y)[1];
    const wheelCount = preset.blueprint.axles.length * 2;
    checks.check(`${preset.label}: monta chassi, cabine e rodas com Wheel Collider`, chassis.vehicle !== null && chassis.rigidBody?.type === 'dynamic' && vehicle.wheels.length === wheelCount);
    checks.check(`${preset.label}: todas as rodas tocam o chão`, vehicle.groundedWheelCount === wheelCount);
    checks.near(`${preset.label}: repousa na altura de projeto`, chassis.transform.position[1], restHeight, 0.03);
    checks.check(`${preset.label}: fica parado sem comando`, vehicle.speed < 0.03, `velocidade ${vehicle.speed}`);
    vehicle.input.throttle = 1;
    advance(5);
    checks.check(`${preset.label}: acelera em linha reta`, vehicle.forwardSpeed > LAUNCH_SPEED[preset.id] && Math.abs(chassis.transform.position[0]) < 0.5, `velocidade ${vehicle.forwardSpeed}, x ${chassis.transform.position[0]}`);
    vehicle.input.throttle = 0.4;
    vehicle.input.steer = 1;
    advance(2);
    vehicle.body.localDirectionToWorld(heading, UNIT_Z);
    checks.check(`${preset.label}: faz a curva sem capotar`, heading[0] < -0.2 && uprightness() > 0.9, `rumo x ${heading[0]}, inclinação ${uprightness()}`);
    clearVehicleInput(vehicle.input);
    vehicle.input.brake = 1;
    advance(8);
    checks.check(`${preset.label}: freia até parar de pé`, vehicle.speed < 0.1 && uprightness() > 0.98, `velocidade ${vehicle.speed}, inclinação ${uprightness()}`);
    system.dispose();
    physics.dispose();
}
for (const preset of VEHICLE_PRESETS)
    testPreset(preset);
checks.throws('preset desconhecido é recusado', () => getVehiclePreset('hovercraft' as VehiclePresetId), 'hovercraft');
checks.finish();

import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import type { Quat } from '@/engine/core/math/quat';
import type { Entity } from '@/engine/core/scene/entity';
import { createGroundHit, type GroundHit } from '../ground/ground-probe';
import { createTirePatch, type TirePatch } from '../tire/tire-patch';
import { wheelInertia, type WheelSettings } from '../wheel/wheel-settings';
export interface WheelRig {
    readonly restPosition: Vec3;
    readonly restEuler: Vec3;
    readonly restRotation: Quat;
    readonly bodyToParent: Quat;
    readonly parentScale: Vec3;
}
export interface WheelState {
    readonly entity: Entity;
    readonly rig: WheelRig;
    readonly mount: Vec3;
    readonly contact: GroundHit;
    readonly patch: TirePatch;
    settings: WheelSettings;
    sprungMass: number;
    inertia: number;
    grounded: boolean;
    compression: number;
    compressionSpeed: number;
    load: number;
    angularVelocity: number;
    spinAngle: number;
    steerAngle: number;
    driveTorque: number;
    serviceBrakeTorque: number;
    holdingBrakeTorque: number;
    longitudinalSlip: number;
    lateralSlip: number;
}
export function createWheelState(entity: Entity, settings: WheelSettings, mount: Vec3, rig: WheelRig): WheelState {
    return {
        entity,
        rig,
        mount: vec3.copy(vec3.create(), mount),
        contact: createGroundHit(),
        patch: createTirePatch(),
        settings,
        sprungMass: 0,
        inertia: wheelInertia(settings),
        grounded: false,
        compression: 0,
        compressionSpeed: 0,
        load: 0,
        angularVelocity: 0,
        spinAngle: 0,
        steerAngle: 0,
        driveTorque: 0,
        serviceBrakeTorque: 0,
        holdingBrakeTorque: 0,
        longitudinalSlip: 0,
        lateralSlip: 0,
    };
}

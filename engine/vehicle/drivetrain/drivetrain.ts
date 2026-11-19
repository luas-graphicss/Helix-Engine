import type { WheelState } from '../runtime/wheel-state';
import type { VehicleSettings } from '../vehicle-settings';
import { wheelInertia } from '../wheel/wheel-settings';
import type { DriveCommand } from './drive-command';
import { engineTorqueAt, RPM_PER_RADIAN_PER_SECOND } from './engine-torque';
import { Gearbox, gearRatio } from './gearbox';
const ENGINE_INERTIA_PER_TORQUE = 0.0008;
export class Drivetrain {
    readonly gearbox = new Gearbox();
    engineRpm = 0;
    update(settings: VehicleSettings, wheels: readonly WheelState[], command: DriveCommand, deltaSeconds: number): void {
        const { gearbox } = this;
        if (command.reverse)
            gearbox.engageReverse();
        else
            gearbox.engageForward();
        let drivenCount = 0;
        let drivenSpeed = 0;
        for (const wheel of wheels) {
            if (!wheel.settings.driven)
                continue;
            drivenCount++;
            drivenSpeed += wheel.angularVelocity;
        }
        const share = drivenCount > 0 ? 1 / drivenCount : 0;
        const shaftRpm = Math.abs(drivenSpeed * share) * RPM_PER_RADIAN_PER_SECOND * settings.finalDriveRatio;
        gearbox.shift(settings, shaftRpm, deltaSeconds);
        const overallRatio = gearRatio(settings, gearbox.gear) * settings.finalDriveRatio;
        const coupledRpm = shaftRpm * Math.abs(gearRatio(settings, gearbox.gear));
        this.engineRpm = Math.max(settings.idleRpm, coupledRpm);
        const engineTorque = engineTorqueAt(settings, this.engineRpm) * command.throttle;
        const isCoasting = command.throttle <= 0 && coupledRpm > settings.idleRpm;
        const engineBrake = isCoasting ? settings.engineBraking * Math.abs(overallRatio) * share : 0;
        const reflectedInertia = settings.maxTorque * ENGINE_INERTIA_PER_TORQUE * overallRatio * overallRatio * share;
        for (const wheel of wheels) {
            const { driven, handbrake } = wheel.settings;
            const handbrakeTorque = handbrake ? command.handbrake * settings.handbrakeTorque : 0;
            wheel.serviceBrakeTorque = command.brake * settings.brakeTorque;
            wheel.holdingBrakeTorque = handbrakeTorque + (driven ? engineBrake : 0);
            wheel.driveTorque = driven ? engineTorque * overallRatio * share : 0;
            wheel.inertia = wheelInertia(wheel.settings) + (driven ? reflectedInertia : 0);
        }
    }
}

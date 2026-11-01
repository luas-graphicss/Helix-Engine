import type { RigidBody } from '@/engine/physics/body/rigid-body';
import { BallJoint } from './ball-joint';
import { ConeTwistJoint } from './cone-twist-joint';
import { DistanceJoint } from './distance-joint';
import { FixedJoint } from './fixed-joint';
import { HingeJoint } from './hinge-joint';
import type { Joint } from './joint';
import type { JointDefinition } from './joint-settings';
import { SliderJoint } from './slider-joint';
import { WheelJoint } from './wheel-joint';
export function instantiateJoint(id: number, bodyA: RigidBody, bodyB: RigidBody, definition: JointDefinition): Joint {
    switch (definition.type) {
        case 'ball':
            return new BallJoint(id, bodyA, bodyB, definition);
        case 'hinge':
            return new HingeJoint(id, bodyA, bodyB, definition);
        case 'slider':
            return new SliderJoint(id, bodyA, bodyB, definition);
        case 'fixed':
            return new FixedJoint(id, bodyA, bodyB, definition);
        case 'distance':
            return new DistanceJoint(id, bodyA, bodyB, definition);
        case 'cone-twist':
            return new ConeTwistJoint(id, bodyA, bodyB, definition);
        case 'wheel':
            return new WheelJoint(id, bodyA, bodyB, definition);
    }
}

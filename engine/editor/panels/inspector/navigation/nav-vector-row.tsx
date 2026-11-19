'use client';
import type { Vec3 } from '@/engine/core/math/vec3';
import { PropertyRow } from '@/engine/ui/property-row';
import { Vector3Input, type Axis } from '../number-fields';
export function NavVectorRow({ label, name, hint, values, onCommit }: {
    label: string;
    name: string;
    hint?: string;
    values: Vec3;
    onCommit: (axis: Axis, value: number) => void;
}) {
    return (<PropertyRow label={label} hint={hint}>
      <Vector3Input label={name} values={values} onCommit={onCommit}/>
    </PropertyRow>);
}

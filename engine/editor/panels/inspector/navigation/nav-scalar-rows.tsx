'use client';
import { PropertyRow } from '@/engine/ui/property-row';
import { ScalarField } from '../number-fields';
export interface NavScalarRow<K extends string> {
    readonly key: K;
    readonly label: string;
    readonly hint: string;
    readonly suffix: string;
}
export function NavScalarRows<K extends string>({ rows, owner, values, onCommit }: {
    rows: ReadonlyArray<NavScalarRow<K>>;
    owner: string;
    values: Readonly<Record<K, number>>;
    onCommit: (key: K, value: number) => void;
}) {
    return (<>
      {rows.map(({ key, label, hint, suffix }) => (<PropertyRow key={key} label={label} hint={hint}>
          <ScalarField label={`${label} ${owner}`} value={values[key]} suffix={suffix} onCommit={(value) => onCommit(key, value)}/>
        </PropertyRow>))}
    </>);
}

import { areaBit } from '../areas/nav-areas';
export interface NavQueryFilter {
    readonly areaMask: number;
    readonly areaCosts: ArrayLike<number>;
}
export function allowsArea(filter: NavQueryFilter, area: number): boolean {
    return (filter.areaMask & areaBit(area)) !== 0;
}

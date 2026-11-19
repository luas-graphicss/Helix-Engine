import { PORTAL_FLOATS } from '../mesh/build-polygons';
const SAME_POINT = 1e-5;
function turn(originX: number, originZ: number, firstX: number, firstZ: number, secondX: number, secondZ: number): number {
    return (firstX - originX) * (secondZ - originZ) - (firstZ - originZ) * (secondX - originX);
}
function isSamePoint(firstX: number, firstZ: number, secondX: number, secondZ: number): boolean {
    return Math.abs(firstX - secondX) < SAME_POINT && Math.abs(firstZ - secondZ) < SAME_POINT;
}
export function pullString(portals: ArrayLike<number>, portalCount: number, corners: number[]): void {
    let apexX = portals[0];
    let apexY = portals[1];
    let apexZ = portals[2];
    let leftX = apexX;
    let leftY = apexY;
    let leftZ = apexZ;
    let rightX = apexX;
    let rightY = apexY;
    let rightZ = apexZ;
    let leftIndex = 0;
    let rightIndex = 0;
    corners.push(apexX, apexY, apexZ);
    for (let index = 1; index < portalCount; index++) {
        const offset = index * PORTAL_FLOATS;
        const nextLeftX = portals[offset];
        const nextLeftZ = portals[offset + 2];
        const nextRightX = portals[offset + 3];
        const nextRightZ = portals[offset + 5];
        if (turn(apexX, apexZ, rightX, rightZ, nextRightX, nextRightZ) >= 0) {
            if (isSamePoint(apexX, apexZ, rightX, rightZ) || turn(apexX, apexZ, leftX, leftZ, nextRightX, nextRightZ) < 0) {
                rightX = nextRightX;
                rightY = portals[offset + 4];
                rightZ = nextRightZ;
                rightIndex = index;
            }
            else {
                corners.push(leftX, leftY, leftZ);
                apexX = leftX;
                apexY = leftY;
                apexZ = leftZ;
                rightX = apexX;
                rightY = apexY;
                rightZ = apexZ;
                rightIndex = leftIndex;
                index = leftIndex;
                continue;
            }
        }
        if (turn(apexX, apexZ, leftX, leftZ, nextLeftX, nextLeftZ) <= 0) {
            if (isSamePoint(apexX, apexZ, leftX, leftZ) || turn(apexX, apexZ, rightX, rightZ, nextLeftX, nextLeftZ) > 0) {
                leftX = nextLeftX;
                leftY = portals[offset + 1];
                leftZ = nextLeftZ;
                leftIndex = index;
            }
            else {
                corners.push(rightX, rightY, rightZ);
                apexX = rightX;
                apexY = rightY;
                apexZ = rightZ;
                leftX = apexX;
                leftY = apexY;
                leftZ = apexZ;
                leftIndex = rightIndex;
                index = rightIndex;
            }
        }
    }
    const last = (portalCount - 1) * PORTAL_FLOATS;
    corners.push(portals[last], portals[last + 1], portals[last + 2]);
}

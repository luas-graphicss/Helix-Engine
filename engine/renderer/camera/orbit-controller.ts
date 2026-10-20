import * as vec3 from '@/engine/core/math/vec3';
import { clamp, degToRad } from '@/engine/core/math/scalar';
import type { PerspectiveCamera } from './perspective-camera';
const MIN_POLAR = degToRad(1);
const MAX_POLAR = degToRad(179);
export class OrbitController {
    azimuth = degToRad(-45);
    polar = degToRad(60);
    distance = 8;
    minDistance = 0.2;
    maxDistance = 200;
    orbitSpeed = 0.006;
    panSpeed = 0.0025;
    zoomSpeed = 0.0015;
    private readonly scratchForward = vec3.create();
    private readonly scratchRight = vec3.create();
    private readonly scratchUp = vec3.create();
    private readonly worldUp = vec3.create(0, 1, 0);
    constructor(private readonly camera: PerspectiveCamera) {
        this.apply();
    }
    orbit(deltaX: number, deltaY: number): void {
        this.azimuth -= deltaX * this.orbitSpeed;
        this.polar = clamp(this.polar - deltaY * this.orbitSpeed, MIN_POLAR, MAX_POLAR);
        this.apply();
    }
    pan(deltaX: number, deltaY: number): void {
        const { camera } = this;
        vec3.subtract(this.scratchForward, camera.target, camera.position);
        vec3.normalize(this.scratchForward, this.scratchForward);
        vec3.cross(this.scratchRight, this.scratchForward, this.worldUp);
        vec3.normalize(this.scratchRight, this.scratchRight);
        vec3.cross(this.scratchUp, this.scratchRight, this.scratchForward);
        const scale = this.distance * this.panSpeed;
        vec3.scaleAndAdd(camera.target, camera.target, this.scratchRight, -deltaX * scale);
        vec3.scaleAndAdd(camera.target, camera.target, this.scratchUp, deltaY * scale);
        this.apply();
    }
    zoom(deltaWheel: number): void {
        const factor = Math.exp(deltaWheel * this.zoomSpeed);
        this.distance = clamp(this.distance * factor, this.minDistance, this.maxDistance);
        this.apply();
    }
    focus(target: vec3.Vec3, distance?: number): void {
        vec3.copy(this.camera.target, target);
        if (distance !== undefined)
            this.distance = clamp(distance, this.minDistance, this.maxDistance);
        this.apply();
    }
    private apply(): void {
        const sinPolar = Math.sin(this.polar);
        const { camera } = this;
        camera.position[0] = camera.target[0] + this.distance * sinPolar * Math.sin(this.azimuth);
        camera.position[1] = camera.target[1] + this.distance * Math.cos(this.polar);
        camera.position[2] = camera.target[2] + this.distance * sinPolar * Math.cos(this.azimuth);
    }
}

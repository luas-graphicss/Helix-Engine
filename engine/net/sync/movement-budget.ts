import { distanceSquared } from './transform-state';
const BUDGET_SECONDS = 1;
const SPEED_TOLERANCE = 1.25;
const POSITION_SLACK = 0.25;
export class MovementBudget {
    private allowance: number;
    private lastAt: number | null = null;
    constructor(private readonly maxSpeed: number) {
        this.allowance = maxSpeed * BUDGET_SECONDS;
    }
    allows(previous: ArrayLike<number>, next: ArrayLike<number>, nowMs: number): boolean {
        if (this.maxSpeed <= 0)
            return true;
        const elapsedSeconds = this.lastAt === null ? 0 : Math.max(0, nowMs - this.lastAt) / 1000;
        this.lastAt = nowMs;
        const ceiling = this.maxSpeed * BUDGET_SECONDS * SPEED_TOLERANCE;
        this.allowance = Math.min(ceiling, this.allowance + this.maxSpeed * SPEED_TOLERANCE * elapsedSeconds);
        const distance = Math.sqrt(distanceSquared(previous, next));
        if (distance > this.allowance + POSITION_SLACK)
            return false;
        this.allowance = Math.max(0, this.allowance - distance);
        return true;
    }
}

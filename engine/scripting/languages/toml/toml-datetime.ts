export type TomlDateTimeKind = 'offset-date-time' | 'local-date-time' | 'local-date' | 'local-time';
export interface TomlDateTimeFields {
    readonly kind: TomlDateTimeKind;
    readonly year: number;
    readonly month: number;
    readonly day: number;
    readonly hour: number;
    readonly minute: number;
    readonly second: number;
    readonly nanosecond: number;
    readonly offsetMinutes: number | null;
}
function pad(value: number, width: number): string {
    return String(value).padStart(width, '0');
}
function fraction(nanosecond: number): string {
    if (nanosecond === 0)
        return '';
    return `.${pad(nanosecond, 9).replace(/0+$/, '')}`;
}
export class TomlDateTime implements TomlDateTimeFields {
    readonly kind: TomlDateTimeKind;
    readonly year: number;
    readonly month: number;
    readonly day: number;
    readonly hour: number;
    readonly minute: number;
    readonly second: number;
    readonly nanosecond: number;
    readonly offsetMinutes: number | null;
    constructor(fields: TomlDateTimeFields) {
        this.kind = fields.kind;
        this.year = fields.year;
        this.month = fields.month;
        this.day = fields.day;
        this.hour = fields.hour;
        this.minute = fields.minute;
        this.second = fields.second;
        this.nanosecond = fields.nanosecond;
        this.offsetMinutes = fields.offsetMinutes;
    }
    get millisecond(): number {
        return Math.floor(this.nanosecond / 1000000);
    }
    toDate(): Date {
        const { year, month, day, hour, minute, second, millisecond } = this;
        if (this.kind === 'offset-date-time') {
            const utc = Date.UTC(year, month - 1, day, hour, minute, second, millisecond);
            return new Date(utc - (this.offsetMinutes ?? 0) * 60000);
        }
        if (this.kind === 'local-time')
            return new Date(1970, 0, 1, hour, minute, second, millisecond);
        return new Date(year, month - 1, day, hour, minute, second, millisecond);
    }
    valueOf(): number {
        return this.toDate().getTime();
    }
    toString(): string {
        const date = `${pad(this.year, 4)}-${pad(this.month, 2)}-${pad(this.day, 2)}`;
        const time = `${pad(this.hour, 2)}:${pad(this.minute, 2)}:${pad(this.second, 2)}${fraction(this.nanosecond)}`;
        switch (this.kind) {
            case 'local-date':
                return date;
            case 'local-time':
                return time;
            case 'local-date-time':
                return `${date}T${time}`;
            case 'offset-date-time': {
                const offset = this.offsetMinutes ?? 0;
                if (offset === 0)
                    return `${date}T${time}Z`;
                const sign = offset < 0 ? '-' : '+';
                const absolute = Math.abs(offset);
                return `${date}T${time}${sign}${pad(Math.floor(absolute / 60), 2)}:${pad(absolute % 60, 2)}`;
            }
        }
    }
    toJSON(): string {
        return this.toString();
    }
    get [Symbol.toStringTag](): string {
        return 'TomlDateTime';
    }
}
export function isTomlDateTime(value: unknown): value is TomlDateTime {
    return value instanceof TomlDateTime;
}

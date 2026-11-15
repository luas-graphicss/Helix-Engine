export class ToolFailure extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ToolFailure';
    }
}

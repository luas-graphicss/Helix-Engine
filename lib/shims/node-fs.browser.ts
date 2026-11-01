function unavailable(): never {
    throw new Error('`fs` não existe no navegador.');
}
export const readFileSync = unavailable;
export const readFile = unavailable;
export const existsSync = (): boolean => false;
export default { readFileSync, readFile, existsSync };

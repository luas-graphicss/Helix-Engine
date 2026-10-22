function compact(value: number, digits: number): string {
    return Number(value.toFixed(digits)).toLocaleString('pt-BR');
}
export const meters = (value: number) => `${compact(value, value < 10 ? 2 : 1)} m`;
export const centimeters = (value: number) => `${compact(value * 100, 1)} cm`;
export const degrees = (value: number) => `${Math.round(value)}°`;
export const percent = (value: number) => `${Math.round(value * 100)}%`;
export const times = (value: number) => `${compact(value, 2)}×`;
export const seconds = (value: number) => `${compact(value, value < 10 ? 1 : 0)} s`;
export const perSquareMeter = (value: number) => `${Math.round(value)}/m²`;
export const integer = (value: number) => Math.round(value).toLocaleString('pt-BR');
export const passes = (value: number) => (value === 0 ? 'Nenhuma' : `${Math.round(value)} passada${value === 1 ? '' : 's'}`);

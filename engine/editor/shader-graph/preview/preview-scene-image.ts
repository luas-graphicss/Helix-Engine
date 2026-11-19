const WIDTH = 512;
const HEIGHT = 288;
const HORIZON = HEIGHT * 0.62;
const HILLS: readonly (readonly [
    number,
    number
])[] = [[0, HORIZON], [70, HORIZON - 46], [150, HORIZON - 12], [240, HORIZON - 70], [330, HORIZON - 20], [420, HORIZON - 54], [WIDTH, HORIZON - 8], [WIDTH, HORIZON], [0, HORIZON]];
const BLOCKS: readonly (readonly [
    number,
    number,
    number,
    number,
    string
])[] = [[60, HORIZON - 4, 54, 78, '#c8452e'], [150, HORIZON + 8, 70, 64, '#2f8f6b'], [270, HORIZON - 10, 46, 96, '#e0b23a'], [360, HORIZON + 14, 86, 52, '#3567c4']];
export function createPreviewSceneImage(): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    const context = canvas.getContext('2d');
    if (!context)
        throw new Error('O canvas 2D não está disponível para a cena de teste do pós-processamento.');
    context.translate(0, HEIGHT);
    context.scale(1, -1);
    const sky = context.createLinearGradient(0, 0, 0, HORIZON);
    sky.addColorStop(0, '#2c6cb4');
    sky.addColorStop(1, '#f3c890');
    context.fillStyle = sky;
    context.fillRect(0, 0, WIDTH, HORIZON);
    context.fillStyle = '#fff1c2';
    context.beginPath();
    context.arc(WIDTH * 0.74, HORIZON * 0.34, 22, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#5b6f8f';
    context.beginPath();
    HILLS.forEach(([x, y], index) => (index === 0 ? context.moveTo(x, y) : context.lineTo(x, y)));
    context.fill();
    const ground = context.createLinearGradient(0, HORIZON, 0, HEIGHT);
    ground.addColorStop(0, '#6f8b52');
    ground.addColorStop(1, '#2c3a26');
    context.fillStyle = ground;
    context.fillRect(0, HORIZON, WIDTH, HEIGHT - HORIZON);
    for (const [x, y, width, height, color] of BLOCKS) {
        context.fillStyle = color;
        context.fillRect(x, y, width, height);
    }
    return canvas;
}

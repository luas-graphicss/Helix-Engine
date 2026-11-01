import type { GuiDeviceRect, GuiEmulatedCutout, GuiEmulatedScreen } from '@/engine/gui/devices/device-geometry';
import type { GuiViewState } from '../../gui-designer';
interface DeviceDrawFrame {
    readonly view: GuiViewState;
    readonly screen: GuiEmulatedScreen;
}
const BODY_TOP = '#2b2e35';
const BODY_BOTTOM = '#17191e';
const BODY_EDGE = 'rgba(255,255,255,0.08)';
const BODY_DETAIL = '#0e1013';
const HARDWARE_BLACK = '#050506';
const LENS = '#1c2029';
const INDICATOR = 'rgba(255,255,255,0.82)';
const STATUS_TEXT = 'rgba(255,255,255,0.92)';
const STATUS_TIME: Record<string, string> = { ios: '9:41', ipados: '9:41', android: '12:30' };
function css(frame: DeviceDrawFrame, rect: GuiDeviceRect): GuiDeviceRect {
    const { zoom, panX, panY } = frame.view;
    return { x: panX + rect.x * zoom, y: panY + rect.y * zoom, width: rect.width * zoom, height: rect.height * zoom };
}
function roundRect(context: CanvasRenderingContext2D, rect: GuiDeviceRect, radius: number | readonly number[]): void {
    context.beginPath();
    context.roundRect(rect.x, rect.y, rect.width, rect.height, radius as number | DOMPointInit[]);
}
function fillRoundRect(context: CanvasRenderingContext2D, rect: GuiDeviceRect, radius: number, color: string): void {
    roundRect(context, rect, radius);
    context.fillStyle = color;
    context.fill();
}
function bodyGradient(context: CanvasRenderingContext2D, rect: GuiDeviceRect): CanvasGradient {
    const gradient = context.createLinearGradient(0, rect.y, 0, rect.y + rect.height);
    gradient.addColorStop(0, BODY_TOP);
    gradient.addColorStop(1, BODY_BOTTOM);
    return gradient;
}
function drawSideButtons(context: CanvasRenderingContext2D, body: GuiDeviceRect, zoom: number, portrait: boolean): void {
    const thickness = Math.max(1.5, 3 * zoom);
    const long = Math.max(6, (portrait ? body.height : body.width) * 0.055);
    const start = (portrait ? body.height : body.width) * 0.2;
    context.fillStyle = BODY_DETAIL;
    if (portrait) {
        context.fillRect(body.x - thickness, body.y + start, thickness, long);
        context.fillRect(body.x - thickness, body.y + start + long * 1.4, thickness, long);
        context.fillRect(body.x + body.width, body.y + start + long * 0.6, thickness, long * 1.4);
    }
    else {
        context.fillRect(body.x + start, body.y - thickness, long, thickness);
        context.fillRect(body.x + start + long * 1.4, body.y - thickness, long, thickness);
        context.fillRect(body.x + start + long * 0.6, body.y + body.height, long * 1.4, thickness);
    }
}
function drawLaptopDeck(context: CanvasRenderingContext2D, body: GuiDeviceRect, stand: number, zoom: number): void {
    const overhang = body.width * 0.06;
    const deck: GuiDeviceRect = { x: body.x - overhang, y: body.y + body.height, width: body.width + overhang * 2, height: stand * zoom };
    const gradient = context.createLinearGradient(0, deck.y, 0, deck.y + deck.height);
    gradient.addColorStop(0, '#34373f');
    gradient.addColorStop(0.12, '#24272e');
    gradient.addColorStop(1, '#121418');
    roundRect(context, deck, [0, 0, deck.height * 0.5, deck.height * 0.5]);
    context.fillStyle = gradient;
    context.fill();
    const notchWidth = body.width * 0.14;
    context.fillStyle = BODY_DETAIL;
    context.fillRect(deck.x + deck.width / 2 - notchWidth / 2, deck.y, notchWidth, Math.max(1, deck.height * 0.18));
}
function drawMonitorStand(context: CanvasRenderingContext2D, body: GuiDeviceRect, stand: number, zoom: number): void {
    const total = stand * zoom;
    const neck: GuiDeviceRect = { x: body.x + body.width / 2 - body.width * 0.035, y: body.y + body.height, width: body.width * 0.07, height: total * 0.6 };
    const base: GuiDeviceRect = { x: body.x + body.width / 2 - body.width * 0.17, y: neck.y + neck.height, width: body.width * 0.34, height: total * 0.4 };
    context.fillStyle = BODY_BOTTOM;
    context.fillRect(neck.x, neck.y, neck.width, neck.height);
    roundRect(context, base, base.height * 0.5);
    context.fillStyle = bodyGradient(context, base);
    context.fill();
}
function drawHandheldControls(context: CanvasRenderingContext2D, body: GuiDeviceRect, screen: GuiDeviceRect): void {
    const gripWidth = screen.x - body.x;
    const stickRadius = gripWidth * 0.22;
    const centerY = screen.y + screen.height * 0.42;
    context.fillStyle = BODY_DETAIL;
    context.beginPath();
    context.arc(body.x + gripWidth * 0.5, centerY, stickRadius, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#3a3e47';
    context.beginPath();
    context.arc(body.x + gripWidth * 0.5, centerY, stickRadius * 0.62, 0, Math.PI * 2);
    context.fill();
    const buttonRadius = gripWidth * 0.085;
    const rightCenterX = screen.x + screen.width + gripWidth * 0.5;
    context.fillStyle = BODY_DETAIL;
    for (const [dx, dy] of [
        [0, -1],
        [1, 0],
        [0, 1],
        [-1, 0],
    ]) {
        context.beginPath();
        context.arc(rightCenterX + dx * buttonRadius * 2.1, centerY + dy * buttonRadius * 2.1, buttonRadius, 0, Math.PI * 2);
        context.fill();
    }
    context.fillStyle = BODY_DETAIL;
    context.beginPath();
    context.arc(body.x + gripWidth * 0.5, centerY + screen.height * 0.32, stickRadius * 0.85, 0, Math.PI * 2);
    context.arc(rightCenterX, centerY + screen.height * 0.32, stickRadius * 0.85, 0, Math.PI * 2);
    context.fill();
}
export function drawDeviceBody(context: CanvasRenderingContext2D, frame: DeviceDrawFrame): void {
    const { screen, view } = frame;
    const body = screen.frame;
    if (!body)
        return;
    const { bezel } = body;
    const screenRect = css(frame, { x: 0, y: 0, width: screen.width, height: screen.height });
    const bodyRect = css(frame, { x: -bezel.left, y: -bezel.top, width: screen.width + bezel.left + bezel.right, height: screen.height + bezel.top + bezel.bottom });
    const radius = body.radius * view.zoom;
    context.save();
    if (body.style === 'laptop')
        drawLaptopDeck(context, bodyRect, body.stand, view.zoom);
    if (body.style === 'monitor')
        drawMonitorStand(context, bodyRect, body.stand, view.zoom);
    context.save();
    context.shadowColor = 'rgba(0,0,0,0.6)';
    context.shadowBlur = 36;
    context.shadowOffsetY = 10;
    roundRect(context, bodyRect, radius);
    context.fillStyle = bodyGradient(context, bodyRect);
    context.fill();
    context.restore();
    roundRect(context, bodyRect, radius);
    context.lineWidth = 1;
    context.strokeStyle = BODY_EDGE;
    context.stroke();
    if (body.style === 'phone' || body.style === 'tablet')
        drawSideButtons(context, bodyRect, view.zoom, screen.orientation === 'portrait');
    if (body.style === 'handheld')
        drawHandheldControls(context, bodyRect, screenRect);
    context.restore();
}
export function traceScreen(context: CanvasRenderingContext2D, frame: DeviceDrawFrame, cornerRadius: number): void {
    const rect = css(frame, { x: 0, y: 0, width: frame.screen.width, height: frame.screen.height });
    roundRect(context, rect, cornerRadius * frame.view.zoom);
}
function notchRadii(cutout: GuiEmulatedCutout, screen: GuiEmulatedScreen, zoom: number): number[] {
    const round = Math.min(cutout.width, cutout.height) * 0.45 * zoom;
    if (cutout.y <= 0)
        return [0, 0, round, round];
    if (cutout.x <= 0)
        return [0, round, round, 0];
    if (cutout.x + cutout.width >= screen.width)
        return [round, 0, 0, round];
    return [round, round, 0, 0];
}
function drawCutout(context: CanvasRenderingContext2D, frame: DeviceDrawFrame, cutout: GuiEmulatedCutout): void {
    const rect = css(frame, cutout);
    context.fillStyle = HARDWARE_BLACK;
    switch (cutout.kind) {
        case 'notch':
            roundRect(context, rect, notchRadii(cutout, frame.screen, frame.view.zoom));
            context.fill();
            break;
        case 'island':
            roundRect(context, rect, Math.min(rect.width, rect.height) / 2);
            context.fill();
            break;
        case 'punch-hole': {
            const centerX = rect.x + rect.width / 2;
            const centerY = rect.y + rect.height / 2;
            const radius = Math.min(rect.width, rect.height) / 2;
            context.beginPath();
            context.arc(centerX, centerY, radius, 0, Math.PI * 2);
            context.fill();
            context.fillStyle = LENS;
            context.beginPath();
            context.arc(centerX, centerY, radius * 0.55, 0, Math.PI * 2);
            context.fill();
            break;
        }
    }
}
function drawBattery(context: CanvasRenderingContext2D, x: number, centerY: number, scale: number): void {
    const width = 25 * scale;
    const height = 12 * scale;
    const y = centerY - height / 2;
    context.lineWidth = Math.max(1, scale);
    context.strokeStyle = STATUS_TEXT;
    roundRect(context, { x, y, width, height }, 3 * scale);
    context.stroke();
    context.fillStyle = STATUS_TEXT;
    roundRect(context, { x: x + 2 * scale, y: y + 2 * scale, width: (width - 4 * scale) * 0.8, height: height - 4 * scale }, 1.5 * scale);
    context.fill();
    context.fillRect(x + width + scale, centerY - 2 * scale, 1.5 * scale, 4 * scale);
}
function drawSignalBars(context: CanvasRenderingContext2D, x: number, centerY: number, scale: number): void {
    context.fillStyle = STATUS_TEXT;
    for (let index = 0; index < 4; index++) {
        const barHeight = (4 + index * 2.5) * scale;
        context.fillRect(x + index * 4.5 * scale, centerY + 5.5 * scale - barHeight, 3 * scale, barHeight);
    }
}
function drawWifi(context: CanvasRenderingContext2D, x: number, centerY: number, scale: number): void {
    context.strokeStyle = STATUS_TEXT;
    context.lineWidth = Math.max(1, 1.8 * scale);
    context.lineCap = 'round';
    const originY = centerY + 5 * scale;
    for (const radius of [3.5, 7, 10.5]) {
        context.beginPath();
        context.arc(x, originY, radius * scale, Math.PI * 1.25, Math.PI * 1.75);
        context.stroke();
    }
    context.fillStyle = STATUS_TEXT;
    context.beginPath();
    context.arc(x, originY, 1.2 * scale, 0, Math.PI * 2);
    context.fill();
}
function drawStatusBar(context: CanvasRenderingContext2D, frame: DeviceDrawFrame): void {
    const { screen, view } = frame;
    const scale = view.zoom;
    if (screen.statusBarHeight <= 0 || 15 * scale < 6)
        return;
    const cutout = screen.cutouts[0] ?? null;
    const centerY = view.panY + (cutout ? cutout.y + cutout.height / 2 : screen.statusBarHeight / 2) * scale;
    const sideMargin = (cutout ? Math.max(18, cutout.x * 0.32) : 18) * scale;
    const left = view.panX + sideMargin;
    const right = view.panX + screen.width * scale - sideMargin;
    context.save();
    context.shadowColor = 'rgba(0,0,0,0.55)';
    context.shadowBlur = 3 * scale;
    context.font = `600 ${15 * scale}px ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
    context.textBaseline = 'middle';
    context.textAlign = 'left';
    context.fillStyle = STATUS_TEXT;
    context.fillText(STATUS_TIME[screen.spec?.platform ?? ''] ?? '12:30', left, centerY);
    drawBattery(context, right - 27 * scale, centerY, scale);
    drawWifi(context, right - 41 * scale, centerY, scale);
    drawSignalBars(context, right - 65 * scale, centerY, scale);
    context.restore();
}
export function drawDeviceHardware(context: CanvasRenderingContext2D, frame: DeviceDrawFrame): void {
    const { screen } = frame;
    context.save();
    for (const cutout of screen.cutouts)
        drawCutout(context, frame, cutout);
    if (screen.homeIndicator) {
        const rect = css(frame, screen.homeIndicator);
        context.shadowColor = 'rgba(0,0,0,0.45)';
        context.shadowBlur = 2;
        fillRoundRect(context, rect, rect.height / 2, INDICATOR);
        context.shadowBlur = 0;
    }
    drawStatusBar(context, frame);
    context.restore();
}

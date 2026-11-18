export interface RadianceImage {
    readonly width: number;
    readonly height: number;
    readonly rgbe: Uint8Array;
}
export class RadianceFormatError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'RadianceFormatError';
    }
}
const SIGNATURES: readonly string[] = ['#?RADIANCE', '#?RGBE'];
const FORMAT_LINE = 'FORMAT=32-bit_rle_rgbe';
const RESOLUTION_PATTERN = /^-Y (\d+) \+X (\d+)$/;
const LINE_FEED = 0x0a;
const MAX_HEADER_LINES = 64;
const MAX_LINE_LENGTH = 512;
const MAX_DIMENSION = 8192;
const CHANNELS = 4;
const RLE_MARKER = 2;
const RLE_MIN_WIDTH = 8;
const RLE_MAX_WIDTH = 0x7fff;
const RUN_FLAG = 128;
const EXPONENT_BIAS = 136;
class ByteCursor {
    private offset = 0;
    constructor(private readonly bytes: Uint8Array) { }
    readLine(): string {
        const end = this.bytes.indexOf(LINE_FEED, this.offset);
        if (end < 0 || end - this.offset > MAX_LINE_LENGTH)
            throw new RadianceFormatError('The Radiance HDR header is malformed.');
        const line = String.fromCharCode(...this.bytes.subarray(this.offset, end));
        this.offset = end + 1;
        return line.trim();
    }
    readByte(): number {
        if (this.offset >= this.bytes.length)
            throw new RadianceFormatError('The Radiance HDR file ends before the last pixel.');
        return this.bytes[this.offset++];
    }
    readInto(target: Uint8Array, start: number, length: number): void {
        if (this.offset + length > this.bytes.length)
            throw new RadianceFormatError('The Radiance HDR file ends before the last pixel.');
        target.set(this.bytes.subarray(this.offset, this.offset + length), start);
        this.offset += length;
    }
}
function readDimensions(cursor: ByteCursor): { width: number; height: number } {
    if (!SIGNATURES.includes(cursor.readLine()))
        throw new RadianceFormatError('The file is not a Radiance HDR image.');
    let hasFormat = false;
    for (let lineCount = 0; lineCount < MAX_HEADER_LINES; lineCount++) {
        const line = cursor.readLine();
        if (line === FORMAT_LINE)
            hasFormat = true;
        if (line !== '')
            continue;
        const resolution = RESOLUTION_PATTERN.exec(cursor.readLine());
        if (!hasFormat || !resolution)
            throw new RadianceFormatError('Only top-down RGBE Radiance HDR images are supported.');
        const height = Number(resolution[1]);
        const width = Number(resolution[2]);
        if (width < 1 || height < 1 || width > MAX_DIMENSION || height > MAX_DIMENSION)
            throw new RadianceFormatError(`The Radiance HDR image must be at most ${MAX_DIMENSION} pixels on each side.`);
        return { width, height };
    }
    throw new RadianceFormatError('The Radiance HDR header is malformed.');
}
function readRunLengthChannel(cursor: ByteCursor, rgbe: Uint8Array, rowStart: number, channel: number, width: number): void {
    let x = 0;
    while (x < width) {
        const count = cursor.readByte();
        const isRun = count > RUN_FLAG;
        const length = isRun ? count - RUN_FLAG : count;
        if (length === 0 || x + length > width)
            throw new RadianceFormatError('A Radiance HDR scanline is corrupted.');
        const runValue = isRun ? cursor.readByte() : 0;
        for (let step = 0; step < length; step++, x++)
            rgbe[rowStart + x * CHANNELS + channel] = isRun ? runValue : cursor.readByte();
    }
}
function readScanline(cursor: ByteCursor, rgbe: Uint8Array, rowStart: number, width: number): void {
    const rowBytes = width * CHANNELS;
    if (width < RLE_MIN_WIDTH || width > RLE_MAX_WIDTH) {
        cursor.readInto(rgbe, rowStart, rowBytes);
        return;
    }
    cursor.readInto(rgbe, rowStart, CHANNELS);
    const isRunLength = rgbe[rowStart] === RLE_MARKER && rgbe[rowStart + 1] === RLE_MARKER && (rgbe[rowStart + 2] & RUN_FLAG) === 0;
    if (!isRunLength) {
        cursor.readInto(rgbe, rowStart + CHANNELS, rowBytes - CHANNELS);
        return;
    }
    if (((rgbe[rowStart + 2] << 8) | rgbe[rowStart + 3]) !== width)
        throw new RadianceFormatError('A Radiance HDR scanline has the wrong width.');
    for (let channel = 0; channel < CHANNELS; channel++)
        readRunLengthChannel(cursor, rgbe, rowStart, channel, width);
}
export function decodeRadianceHdr(bytes: Uint8Array): RadianceImage {
    const cursor = new ByteCursor(bytes);
    const { width, height } = readDimensions(cursor);
    const rgbe = new Uint8Array(width * height * CHANNELS);
    for (let row = 0; row < height; row++)
        readScanline(cursor, rgbe, row * width * CHANNELS, width);
    return { width, height, rgbe };
}
export function radianceScale(exponent: number): number {
    return exponent === 0 ? 0 : 2 ** (exponent - EXPONENT_BIAS);
}

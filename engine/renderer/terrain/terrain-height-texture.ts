import type { GL } from '@/engine/renderer/gl/context';
import type { Terrain } from '@/engine/terrain/core/terrain';
import { clampRegion, createRegion, isRegionEmpty } from '@/engine/terrain/core/heightfield';
export class TerrainHeightTexture {
    readonly texture: WebGLTexture;
    private resolution = 0;
    private version = -1;
    private readonly region = createRegion();
    constructor(private readonly gl: GL) {
        const texture = gl.createTexture();
        if (!texture)
            throw new Error('Não foi possível alocar a textura de alturas do terreno.');
        this.texture = texture;
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.bindTexture(gl.TEXTURE_2D, null);
    }
    sync(terrain: Terrain): void {
        const { heightfield, heightLog } = terrain;
        const { resolution, heights } = heightfield;
        if (heightLog.version === this.version && resolution === this.resolution)
            return;
        const { gl, region } = this;
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        if (resolution !== this.resolution || !heightLog.collect(this.version, region)) {
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, resolution, resolution, 0, gl.RED, gl.FLOAT, heights);
            this.resolution = resolution;
        }
        else if (!isRegionEmpty(region)) {
            clampRegion(region, resolution);
            const { x0, z0, x1, z1 } = region;
            gl.pixelStorei(gl.UNPACK_ROW_LENGTH, resolution);
            gl.pixelStorei(gl.UNPACK_SKIP_PIXELS, x0);
            gl.pixelStorei(gl.UNPACK_SKIP_ROWS, z0);
            gl.texSubImage2D(gl.TEXTURE_2D, 0, x0, z0, x1 - x0 + 1, z1 - z0 + 1, gl.RED, gl.FLOAT, heights);
            gl.pixelStorei(gl.UNPACK_ROW_LENGTH, 0);
            gl.pixelStorei(gl.UNPACK_SKIP_PIXELS, 0);
            gl.pixelStorei(gl.UNPACK_SKIP_ROWS, 0);
        }
        gl.bindTexture(gl.TEXTURE_2D, null);
        this.version = heightLog.version;
    }
    dispose(): void {
        this.gl.deleteTexture(this.texture);
    }
}

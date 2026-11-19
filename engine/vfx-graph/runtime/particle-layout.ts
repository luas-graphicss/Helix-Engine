export const PARTICLE_ATTRIBUTE_COUNT = 4;
export const ATTRIBUTE_COMPONENTS = 4;
export const ATTRIBUTE_BYTES = ATTRIBUTE_COMPONENTS * Float32Array.BYTES_PER_ELEMENT;
export const PARTICLE_STRIDE_BYTES = PARTICLE_ATTRIBUTE_COUNT * ATTRIBUTE_BYTES;
export const FEEDBACK_VARYINGS = ['v_positionAge', 'v_velocityLife', 'v_color', 'v_shape'] as const;

export const POST_GLSL = `                                                
                                                                                
                                                                                                                                   
uniform vec3 tint;
uniform float strength;

void main() {
	vec3 color = texture(uSceneColor, vUv).rgb;
	float depth = helixLinearDepth(texture(uSceneDepth, vUv).r);
	float fog = 1.0 - exp(-depth * 0.015);
	float edge = smoothstep(0.4, 0.95, distance(vUv, vec2(0.5)));
	float scan = 0.5 + 0.5 * sin(vUv.y * uResolution.y * 0.25 + uTime * 2.0);
	vec3 tinted = mix(color, tint, edge * strength);
	tinted = mix(tinted, tint * 0.5 + 0.5, fog * 0.15);
	fragColor = vec4(tinted * (0.97 + 0.03 * scan), 1.0);
}
`;
export const SURFACE_GLSL = `// DebugSuperficie · Shader de superfície do modo debug
// Helix Engine: listras animadas e brilho de borda por cima do material PBR do ator.
// No script: const material = helix.material.fromShader("DebugSuperficie", { glow: [1, 0.45, 0.1], speed: 2 })
uniform vec3 glow;
uniform float speed;

void surface(inout HelixSurface s) {
	float stripes = step(0.5, fract(s.uv.y * 8.0 + uTime * speed * 0.25));
	s.baseColor = mix(s.baseColor, glow, stripes * 0.6);
	s.roughness = mix(0.2, 0.8, stripes);
	s.metallic = 0.3;
	float fresnel = pow(1.0 - max(dot(s.normal, s.viewDirection), 0.0), 3.0);
	s.emissive += glow * fresnel * (0.5 + 0.5 * sin(uTime * speed));
}
`;
export const POST_WGSL = `                                                       
                                                                                
                                                                                                                                   
struct Params {
	tint: vec3<f32>,
	strength: f32,
};
@group(1) @binding(0) var<uniform> params: Params;

@fragment
fn main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
	let color = textureSample(sceneColor, sceneSampler, uv).rgb;
	let depth = helixLinearDepth(textureSample(sceneDepth, sceneSampler, uv).r);
	let fog = 1.0 - exp(-depth * 0.015);
	let edge = smoothstep(0.4, 0.95, distance(uv, vec2<f32>(0.5)));
	let scan = 0.5 + 0.5 * sin(uv.y * helix.resolution.y * 0.25 + helix.time * 2.0);
	var tinted = mix(color, params.tint, edge * params.strength);
	tinted = mix(tinted, params.tint * 0.5 + vec3<f32>(0.5), fog * 0.15);
	return vec4<f32>(tinted * (0.97 + 0.03 * scan), 1.0);
}
`;
export const SURFACE_WGSL = `// DebugSuperficie · Shader de superfície do modo debug (WGSL)
// Helix Engine: listras animadas e brilho de borda por cima do material PBR do ator.
// No script: const material = helix.material.fromShader("DebugSuperficie", { glow: [1, 0.45, 0.1], speed: 2 })
struct Params {
	glow: vec3<f32>,
	speed: f32,
};
@group(1) @binding(0) var<uniform> params: Params;

fn surface(s: ptr<function, HelixSurface>) {
	let stripes = step(0.5, fract((*s).uv.y * 8.0 + helix.time * params.speed * 0.25));
	(*s).baseColor = mix((*s).baseColor, params.glow, stripes * 0.6);
	(*s).roughness = mix(0.2, 0.8, stripes);
	(*s).metallic = 0.3;
	let fresnel = pow(1.0 - max(dot((*s).normal, (*s).viewDirection), 0.0), 3.0);
	(*s).emissive = (*s).emissive + params.glow * fresnel * (0.5 + 0.5 * sin(helix.time * params.speed));
}
`;

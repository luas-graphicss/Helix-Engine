---
title: Matemática
description: helix.math, com vetores, quaternions, matrizes, caixas, raios, escalares, ruído, cor e números aleatórios determinísticos.
order: 4
---

`helix.math` é uma ponte direta de `core/math/*` e `core/noise/*`. Cada linguagem entrega tipos nativos (ou wrappers) com **os mesmos nomes** e a mesma ordem de argumentos. Os tipos são valores simples: `Vec3` é `{x, y, z}`, `Quat` é `{x, y, z, w}`, `Mat4` é uma lista de 16 números em ordem de coluna, `Aabb` é `{min: Vec3, max: Vec3}` e `Ray` é `{origin: Vec3, direction: Vec3}`. As funções nunca alteram os argumentos: devolvem valores novos.

![Os três eixos do mundo renderizados sobre a grade: X para a direita, Y para cima e Z em direção ao observador.](/docs/figures/matematica/eixos.webp "O sistema de coordenadas da engine é de mão direita: X para a direita, Y para cima e Z apontando para quem olha.")

## vec3

| Assinatura | Descrição |
| --- | --- |
| `create(x = 0, y = 0, z = 0): Vec3` | — |
| `add(a, b): Vec3` / `sub(a, b): Vec3` | Soma e diferença. |
| `scale(v, s: number): Vec3` | Multiplica pelo escalar. |
| `dot(a, b): number` / `cross(a, b): Vec3` | Produto escalar e vetorial. |
| `length(v): number` | Comprimento. |
| `normalize(v): Vec3` | Comprimento 1; o vetor zero devolve zero. |
| `lerp(a, b, t: number): Vec3` | Interpolação linear. |
| `distance(a, b): number` | — |
| `transformMat4(v, m: Mat4): Vec3` | Aplica a matriz como ponto (com translação). |
| `transformQuat(v, q: Quat): Vec3` | Rotaciona. |
| `min(a, b): Vec3` / `max(a, b): Vec3` | Por componente. |
| `equals(a, b, epsilon = 1e-6): boolean` | — |

Constantes: `vec3.zero`, `one`, `up` (`0,1,0`), `forward` (`0,0,-1`), `right` (`1,0,0`).

## quat

| Assinatura | Descrição |
| --- | --- |
| `create(x, y, z, w): Quat` / `identity(): Quat` | — |
| `fromEuler(x, y, z): Quat` | A partir de ângulos em graus, ordem XYZ. |
| `toEuler(q): Vec3` | Para ângulos em graus. |
| `multiply(a, b): Quat` | Composição: `b` depois `a`. |
| `slerp(a, b, t): Quat` | Interpolação esférica. |
| `rotateVec3(q, v): Vec3` | Igual a `vec3.transformQuat`. |
| `fromAxisAngle(axis: Vec3, degrees: number): Quat` | — |
| `lookRotation(forward: Vec3, up = vec3.up): Quat` | A rotação que aponta `-Z` para `forward`. |

## mat4 e mat3

| Assinatura | Descrição |
| --- | --- |
| `identity(): Mat4` | — |
| `multiply(a, b): Mat4` | — |
| `invert(m): Mat4 \| null` | `null` se singular. |
| `compose(position, rotation, scale): Mat4` / `fromTRS(...)` | A partir de translação, rotação e escala. |
| `decompose(m): { position, rotation, scale }` | O inverso. |
| `transformPoint(m, p): Vec3` / `transformDirection(m, d): Vec3` | Com e sem translação. |
| `perspective(fovDegrees, aspect, near, far): Mat4` | Projeção perspectiva. |
| `lookAt(eye, target, up): Mat4` | Matriz de vista. |

`mat3` tem `identity`, `multiply`, `invert`, `fromMat4` e `transformDirection`.

## aabb

| Assinatura | Descrição |
| --- | --- |
| `create(min, max): Aabb` / `fromPoints(points: Vec3[]): Aabb` | — |
| `contains(box, point): boolean` | — |
| `intersects(a, b): boolean` | — |
| `expand(box, amount: number \| Vec3): Aabb` | — |
| `center(box): Vec3` / `size(box): Vec3` | — |

## ray

| Assinatura | Descrição |
| --- | --- |
| `create(origin, direction): Ray` | `direction` é normalizada. |
| `at(ray, t: number): Vec3` | O ponto a distância `t`. |
| `fromScreen(x, y, camera?): Ray` | O raio que passa pelo pixel da tela (veja `helix.camera`). |

## scalar

| Assinatura | Descrição |
| --- | --- |
| `clamp(v, min, max)` | — |
| `lerp(a, b, t)` / `inverseLerp(a, b, v)` | — |
| `remap(v, inMin, inMax, outMin, outMax)` | — |
| `smoothstep(edge0, edge1, v)` | — |
| `damp(current, target, lambda, dt)` | Aproximação exponencial independente da taxa de quadros. |
| `wrap(v, min, max)` | — |
| `degToRad(d)` / `radToDeg(r)` | — |

## noise

Ruído determinístico, o mesmo que o terreno usa. Todas as funções recebem coordenadas e uma `seed` opcional e devolvem valores em `-1..1` (`worley` em `0..1`).

| Assinatura | Descrição |
| --- | --- |
| `perlin2(x, y, seed?)` / `perlin3(x, y, z, seed?)` | Ruído de gradiente. |
| `value2(x, y, seed?)` / `value3(x, y, z, seed?)` | Ruído de valor. |
| `worley2(x, y, seed?)` / `worley3(x, y, z, seed?)` | Distância ao ponto mais próximo (celular). |
| `fbm(fn, x, y, z?, { octaves = 4, lacunarity = 2, gain = 0.5 })` | Soma de oitavas de qualquer das funções acima. |

## color

| Assinatura | Descrição |
| --- | --- |
| `srgbToLinear(c: Vec3): Vec3` / `linearToSrgb(c): Vec3` | Conversão de espaço. A engine trabalha em linear. |
| `hexToVec3(hex: string): Vec3` | `"#ff8800"` para linear. |
| `vec3ToHex(c): string` | — |
| `temperatureToColor(kelvin: number): Vec3` | Cor de corpo negro, para luzes. |

## random

Gerador determinístico por semente. Sem `seed`, a semente vem do relógio na primeira chamada; com ela, a sequência é a mesma em toda execução, o que torna a física e os efeitos reproduzíveis.

| Assinatura | Descrição |
| --- | --- |
| `seed(n: number): void` | Define a semente. |
| `value(): number` | Em `[0, 1)`. |
| `range(min, max): number` | Real em `[min, max)`. |
| `int(min, max): number` | Inteiro em `[min, max]`. |
| `pick(list): any` | Um elemento. |
| `shuffle(list): list` | Uma cópia embaralhada. |
| `gaussian(mean = 0, deviation = 1): number` | Distribuição normal. |
| `unitVector(): Vec3` | Direção aleatória uniforme na esfera. |

```luau
helix.math.random.seed(42)
for i = 1, 20 do
  local p = helix.math.vec3.scale(helix.math.random.unitVector(), helix.math.random.range(2, 6))
  local altura = helix.math.noise.perlin2(p.x * 0.3, p.z * 0.3, 7) * 2
  helix.scene.spawn("mesh", { primitive = "sphere", position = { x = p.x, y = altura, z = p.z } })
end
```

```python
cor = helix.math.color.temperature_to_color(3200)
luz.light.color = cor
```

import type { GameSources } from '../types';
export function phpGame(): GameSources {
    const entry = `<?php
                                    
                                                                                  
                                                                                   
declare(strict_types=1);

final class DebugJogo extends \\Helix\\Script
{
    private const LINGUAGEM = 'PHP';
    private const PRAZO_AREA = 5.0;

    private int $quadros = 0;
    private int $passosFisica = 0;
    private int $lateUpdates = 0;
    private int $renders = 0;
    private int $colisoes = 0;
    private int $checagens = 0;
    private int $falhas = 0;
    private int $pontos = 0;
    private float $hudTimer = 0.0;
    private mixed $torus = null;
    private mixed $heroi = null;
    private mixed $efeito = null;
    private mixed $tela = null;
                              
    private array $assinaturas = [];
    private mixed $util = null;

    private function checar(string $nome, mixed $condicao, mixed $detalhe = null): void
    {
        $this->checagens++;
        if ($condicao) {
            return;
        }
        $this->falhas++;
        $sufixo = $detalhe === null ? '' : ': ' . (is_scalar($detalhe) ? (string) $detalhe : json_encode($detalhe, JSON_UNESCAPED_UNICODE));
        $this->helix->log->error('Debug', "FALHOU {$nome}{$sufixo}");
    }

                                                                                                          
    private function area(string $nome, callable $fn): \\Generator
    {
        try {
            $resultado = $fn();
            if ($resultado instanceof \\Generator) {
                yield from $resultado;
            }
            $this->helix->log->debug('Debug', "ok {$nome}");
        } catch (\\Throwable $erro) {
            $this->falhas++;
            $this->helix->log->error('Debug', "ERRO em {$nome}: {$erro->getMessage()}");
        }
    }

    private static function aprox(float $a, float $b, float $epsilon = 0.001): bool
    {
        return abs($a - $b) <= $epsilon;
    }

    private function assinar(mixed $desligar): void
    {
        if (is_callable($desligar)) {
            $this->assinaturas[] = $desligar;
        }
    }

                                                                                             
    private static function mesmo(mixed $a, mixed $b): bool
    {
        return $a instanceof \\Helix\\Ref && $b instanceof \\Helix\\Ref && $a->id === $b->id;
    }

    private static function vec(mixed $v): array
    {
        return [(float) $v->x, (float) $v->y, (float) $v->z];
    }

                                                                                                   

    private function nucleo(): void
    {
        $h = $this->helix;
        $this->checar('engine.name', is_string($h->engine->name) && $h->engine->name !== '');
        $this->checar('engine.version', is_string($h->engine->version));
        $this->checar('context', in_array($h->context, ['shared', 'client', 'server'], true), $h->context);
        $this->checar('isPlaying', $h->isPlaying === true);
        $this->checar('isEditor', $h->isEditor === false);
        $this->checar('self no script de entrada', $h->self === null && $this->self === null);
        $h->log->info('Debug', "{$h->engine->name} {$h->engine->version} · API {$h->engine->apiVersion} · " . self::LINGUAGEM);
    }

    private function modulo(): void
    {
        $this->util = helix_require('DebugUtil');
        $this->checar('helix_require devolve as funções', is_array($this->util) && isset($this->util['soma']));
        $this->checar('require soma', ($this->util['soma'])(2, 3) === 5, ($this->util['soma'])(2, 3));
        $this->checar('require saudacao', ($this->util['saudacao'])('Helix') === 'Olá, Helix', ($this->util['saudacao'])('Helix'));
        $this->checar('require limitar', ($this->util['limitar'])(15, 0, 10) === 10);
        $this->checar("helix_require('helix') é a raiz", helix_require('helix') instanceof \\Helix\\Ref);
    }

    private function matematica(): void
    {
        $m = $this->helix->math;
        $v = $m->vec3->add([1, 2, 3], [1, 1, 1]);
        $this->checar('vec3.add', $m->vec3->equals($v, [2, 3, 4]), self::vec($v));
        $this->checar('vec3.length', self::aprox((float) $m->vec3->length([3, 4, 0]), 5));
        $this->checar('vec3.normalize', self::aprox((float) $m->vec3->length($m->vec3->normalize([0, 5, 0])), 1));
        $this->checar('vec3.cross', $m->vec3->equals($m->vec3->cross([1, 0, 0], [0, 1, 0]), [0, 0, 1]));
        $this->checar('vec3.lerp', $m->vec3->equals($m->vec3->lerp([0, 0, 0], [2, 2, 2], 0.5), [1, 1, 1]));
        $q = $m->quat->fromEuler([0, 90, 0]);
        $this->checar('quat.rotateVec3', $m->vec3->equals($m->quat->rotateVec3($q, [1, 0, 0]), [0, 0, -1], 0.001));
        $this->checar('quat.toEuler', self::aprox((float) $m->quat->toEuler($q)->y, 90, 0.01));
        $mat = $m->mat4->fromTRS([1, 2, 3], [0, 0, 0], [1, 1, 1]);
        $this->checar('mat4.transformPoint', $m->vec3->equals($m->mat4->transformPoint($mat, [0, 0, 0]), [1, 2, 3]));
        $this->checar('mat4.invert', $m->mat4->invert($mat) !== null);
        $caixa = $m->aabb->fromCenterSize([0, 0, 0], [2, 2, 2]);
        $this->checar('aabb.contains', $m->aabb->contains($caixa, [0.5, 0.5, 0.5]) && !$m->aabb->contains($caixa, [2, 0, 0]));
        $raio = $m->ray->create([0, 5, 0], [0, -1, 0]);
        $this->checar('ray.intersectAabb', $m->ray->intersectAabb($raio, $caixa) !== null);
        $this->checar('scalar.remap', (float) $m->scalar->remap(5, 0, 10, 0, 100) === 50.0);
        $this->checar('clamp/lerp', (float) $m->clamp(15, 0, 10) === 10.0 && (float) $m->lerp(0, 10, 0.5) === 5.0);
        $this->checar('scalar.wrapAngle', self::aprox((float) $m->scalar->wrapAngle(370), 10));
        $this->checar('degToRad', self::aprox((float) $m->degToRad(180), M_PI));
        $ruido = (float) $m->noise->perlin2(0.3, 0.7);
        $this->checar('noise.perlin2', $ruido >= -1.01 && $ruido <= 1.01, $ruido);
        $this->checar('noise.fbm', is_float($m->noise->fbm(1.5, 2.5, 0, 4)) || is_int($m->noise->fbm(1.5, 2.5, 0, 4)));
        $this->checar('color.hexToVec3', $m->vec3->equals($m->color->hexToVec3('#ff0000'), [1, 0, 0], 0.01));
        $this->checar('color.vec3ToHex', strtolower((string) $m->color->vec3ToHex([1, 1, 1])) === '#ffffff', $m->color->vec3ToHex([1, 1, 1]));
        $m->random->seed(42);
        $a = $m->random->value();
        $m->random->seed(42);
        $this->checar('random.seed determinístico', $m->random->value() === $a);
        $sorteado = $m->random->int(1, 6);
        $this->checar('random.int', $sorteado >= 1 && $sorteado <= 6 && floor($sorteado) == $sorteado);
        $this->checar('random.unitVector', self::aprox((float) $m->vec3->length($m->random->unitVector()), 1));
        $this->checar('PI/TAU', self::aprox((float) $m->TAU, (float) $m->PI * 2));
    }

                                                                                                         

    private function cena(): void
    {
        $h = $this->helix;
        $s = $h->scene;
                                                                                                              
        $this->checar('scene.root', $s->root !== null && is_iterable($s->root->children) && count($s->root->children) >= 0);
        $antes = (int) $s->count();
        $grupo = $s->spawn('group', ['name' => 'DebugCenario']);
        $chao = $s->spawn('mesh', [
            'name' => 'Chao',
            'mesh' => $h->mesh->plane(40, 40),
            'material' => $h->material->create(['baseColor' => '#4b6b3a', 'roughness' => 0.95]),
            'rigidBody' => ['type' => 'static', 'collider' => 'box', 'boxSize' => [40, 0.2, 40], 'center' => [0, -0.1, 0]],
            'receiveShadows' => true,
            'tags' => ['chao'],
        ], $grupo);
        $this->checar('spawn mesh', $chao->kind === 'mesh' && $chao->mesh !== null && $chao->rigidBody !== null);
        $this->checar('find', self::mesmo($s->find('Chao'), $chao));
        $this->checar('findAll', count($s->findAll('Chao')) === 1);
        $this->checar('byId', self::mesmo($s->byId($chao['id']), $chao));
        $this->checar('byTag', count($s->byTag('chao')) >= 1);
        $this->checar('byKind', count($s->byKind('mesh')) >= 1);
        $this->checar('count', (int) $s->count() === $antes + 2, $s->count() . ' vs ' . ($antes + 2));
        $this->checar('contains', $s->contains($grupo, $chao) && $s->contains($s->root, $chao));
        $this->checar('path', str_contains((string) $s->path($chao), 'Chao'), $s->path($chao));
        $visitados = 0;
        $s->traverse(function () use (&$visitados): void {
            $visitados++;
        }, $grupo);
        $this->checar('traverse', $visitados >= 2, $visitados);

        $torus = $s->spawnPrimitive('torus', ['name' => 'Anel', 'position' => [-4, 1.2, -2], 'scale' => 1.5], $grupo);
        $h->material->setColor($torus, '#3a86ff');
        $h->material->setEmissive($torus, '#3a86ff', 0.6);
        $this->torus = $torus;
        $this->checar('spawnPrimitive', $torus->mesh !== null && $torus->material !== null);

        $copia = $s->clone($torus, true, $grupo);
        $s->rename($copia, 'AnelCopia');
        $h->transform->setPosition($copia, [-4, 1.2, 2]);
        $this->checar('clone + rename', $copia->name === 'AnelCopia' && self::mesmo($s->find('AnelCopia'), $copia));
        $s->setMeta($copia, 'origem', 'clone');
        $this->checar('meta', $s->getMeta($copia, 'origem') === 'clone');
        $s->addTag($copia, 'temporario');
        $this->checar('addTag/hasTag', $s->hasTag($copia, 'temporario'));
        $this->checar('removeTag', $s->removeTag($copia, 'temporario') === true && !$s->hasTag($copia, 'temporario'));
        $s->setVisible($copia, false);
        $this->checar('setVisible', $copia->visible === false);
        $s->setVisible($copia, true);
        $s->destroy($copia);
        $this->checar('destroy', $s->find('AnelCopia') === null && !$s->isAttached($copia));

        $esfera = $s->spawnPrimitive('sphere', ['name' => 'Esfera', 'position' => [4, 0.5, -3]]);
        $s->reparent($esfera, $grupo);
        $this->checar('reparent', self::mesmo($esfera->parent, $grupo));
        $h->material->setColor($esfera, '#ffbe0b');
        $s->addComponent($esfera, 'rigidBody', ['type' => 'dynamic', 'collider' => 'sphere', 'radius' => 0.5, 'mass' => 1]);
        $this->checar('addComponent', $esfera->rigidBody !== null && $esfera->rigidBody->type === 'dynamic');
        $temporario = $s->spawnPrimitive('box', ['name' => 'Temporario']);
        $s->addComponent($temporario, 'csg', []);
        $this->checar('addComponent csg', $temporario->csg !== null);
        $s->removeComponent($temporario, 'csg');
        $this->checar('removeComponent', $temporario->csg === null);
        $s->destroy($temporario);
        $this->checar('kinds/components', in_array('mesh', $s->kinds(), true) && in_array('rigidBody', $s->components(), true));
    }

    private function transformacao(): void
    {
        $h = $this->helix;
        $tr = $h->transform;
        $m = $h->math;
        $alvo = $h->scene->spawnPrimitive('cone', ['name' => 'Cone', 'position' => [0, 0.5, -6]]);
        $h->material->setColor($alvo, '#8338ec');
        $tr->setPosition($alvo, [2, 0.5, -6]);
        $this->checar('setPosition', $m->vec3->equals($tr->position($alvo), [2, 0.5, -6]));
        $tr->translate($alvo, [0, 1, 0], 'world');
        $this->checar('translate', self::aprox((float) $tr->position($alvo)->y, 1.5));
        $tr->setRotation($alvo, [0, 90, 0]);
        $this->checar('setRotation', self::aprox((float) $tr->rotation($alvo)->y, 90, 0.01));
        $tr->rotate($alvo, [0, 45, 0]);
        $girado = (float) $m->scalar->wrapAngle($tr->rotation($alvo)->y);
        $this->checar('rotate', self::aprox($girado, 135, 0.01) || self::aprox($girado, -225, 0.01), $girado);
        $tr->setScale($alvo, 2);
        $this->checar('setScale', self::aprox((float) $tr->scale($alvo)->x, 2));
        $tr->setScale($alvo, [1, 1, 1]);
        $this->checar('worldPosition', $m->vec3->equals($tr->worldPosition($alvo), $tr->position($alvo), 0.001));
        $this->checar('forward/up', self::aprox((float) $m->vec3->length($tr->forward($alvo)), 1) && self::aprox((float) $m->vec3->length($tr->up($alvo)), 1));
        $tr->lookAt($alvo, [0, 1.5, 0]);
        $this->checar('distance', (float) $tr->distance($alvo, [2, 1.5, -6]) < 0.01);
        $this->checar('directionTo', self::aprox((float) $m->vec3->length($tr->directionTo($alvo, [0, 1.5, 0])), 1));
        $limites = $tr->bounds($alvo);
        $this->checar('bounds', $limites !== null && (float) $limites->max->y > (float) $limites->min->y);
        $this->checar('worldMatrix', count($tr->worldMatrix($alvo)) === 16 && count($tr->localMatrix($alvo)) === 16);
        $local = $tr->worldToLocal($alvo, $tr->localToWorld($alvo, [1, 0, 0]));
        $this->checar('localToWorld/worldToLocal', $m->vec3->equals($local, [1, 0, 0], 0.001));
    }

    private function malhas(): void
    {
        $h = $this->helix;
        $me = $h->mesh;
        $caixa = $me->box(1, 1, 1);
        $this->checar('mesh.box', (int) $me->vertexCount($caixa) > 0 && (int) $me->triangleCount($caixa) === 12, $me->triangleCount($caixa));
        $esfera = $me->sphere(0.65, 16, 12);
        $furado = $h->csg->boolean($caixa, $esfera, 'subtract');
        $this->checar('csg.boolean', (int) $me->triangleCount($furado) > 12);
        $ator = $h->scene->spawn('mesh', ['name' => 'CaixaFurada', 'mesh' => $furado, 'material' => $h->material->create(['baseColor' => '#e63946', 'roughness' => 0.4, 'metallic' => 0.2]), 'position' => [4, 0.5, 2]]);
        $this->checar('spawn malha CSG', $ator->mesh !== null);
        $this->checar('csg.operations', in_array('union', $h->csg->operations(), true));
        $tri = $me->create(['name' => 'Triangulo', 'positions' => [-1, 0, 0, 1, 0, 0, 0, 1.5, 0], 'uvs' => [0, 0, 1, 0, 0.5, 1], 'indices' => [0, 1, 2]]);
        $me->computeNormals($tri);
        $this->checar('mesh.create + computeBounds', (float) $me->computeBounds($tri)->max->y >= 1.5);
        $dupla = $me->merge($tri, $me->flipWinding($me->clone($tri)));
        $this->checar('mesh.merge', (int) $me->triangleCount($dupla) === 2);
        $h->scene->spawn('mesh', ['name' => 'Triangulo', 'mesh' => $dupla, 'material' => $h->material->create(['baseColor' => '#06d6a0', 'doubleSided' => true]), 'position' => [7, 0, -2]]);
        $grande = $me->scale($me->translate($me->clone($caixa), [0, 0.5, 0]), 2);
        $this->checar('mesh.translate/scale', (float) $me->computeBounds($grande)->max->y > 1.9);
        $dist = $me->raycast($h->math->ray->create([0, 5, 0], [0, -1, 0]), $grande);
        $this->checar('mesh.raycast', $dist !== null && $dist > 0, $dist);
        $this->checar('positions/indices', count($me->positions($caixa)) === (int) $me->vertexCount($caixa) * 3 && count($me->indices($caixa)) === 36);
        $this->checar('primitivas extras', (int) $me->triangleCount($me->torusKnot()) > 0 && (int) $me->triangleCount($me->capsule()) > 0);
    }

                                                                                                             

    private function materiais(): void
    {
        $h = $this->helix;
        $mat = $h->material;
        $base = $mat->create(['name' => 'DebugBase', 'baseColor' => '#d98c2b', 'roughness' => 0.5, 'metallic' => 0.1]);
        $this->checar('material.create', (float) $base->roughness === 0.5);
        $copia = $mat->clone($base);
        $mat->set($copia, ['roughness' => 1, 'emissive' => '#ffffff', 'emissiveIntensity' => 2]);
        $this->checar('material.clone/set', (float) $copia->roughness === 1.0 && (float) $base->roughness === 0.5);
        $caixa = $h->scene->spawnPrimitive('box', ['name' => 'CaixaPintada', 'position' => [-7, 0.5, 2]]);
        $mat->assign($caixa, $base);
        $this->checar('material.assign/of', $mat->of($caixa) !== null);
        $mat->own($caixa);
        $mat->setColor($caixa, '#d98c2b');
`;
}

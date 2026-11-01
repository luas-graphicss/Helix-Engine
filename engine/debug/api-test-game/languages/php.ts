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
        $tela = $h->texture->canvas(64, 64);
        $tela->update();
        $mat->setTexture($caixa, 'baseColorMap', $tela->texture);
        $this->checar('texture.canvas + setTexture', $mat->hasAnyTexture($mat->of($caixa)) && $h->texture->isTexture($tela->texture));
        $this->checar('material.slots', count($mat->slots()) > 0);
        $this->checar('materials.list', is_array($h->materials->list()));
        $sombreado = $mat->fromShader('DebugSuperficie', ['glow' => [1, 0.45, 0.1], 'speed' => 2]);
        $this->checar('material.fromShader', $sombreado !== null);
        if ($sombreado !== null) {
            $esfera = $h->scene->spawnPrimitive('sphere', ['name' => 'EsferaShader', 'position' => [0, 1, -3], 'scale' => 1.4]);
            $mat->assign($esfera, $sombreado);
            $mat->uniforms($esfera)->set('speed', 3);
            $this->checar('material.uniforms.list', count($mat->uniforms($esfera)->list()) >= 1);
        }
    }

    private function luzes(): void
    {
        $h = $this->helix;
        $l = $h->light;
        $this->checar('light.types', in_array('point', $l->types(), true) && in_array('spot', $l->localTypes(), true));
        $lampada = $l->spawn('point', ['name' => 'Lampada', 'position' => [0, 3, 0], 'color' => '#ffd166', 'intensity' => 60, 'range' => 14]);
        $this->checar('light.spawn', $lampada->light !== null && $lampada->light->type === 'point');
        $l->set($lampada, ['intensity' => 80]);
        $this->checar('light.set', (float) $lampada->light->intensity === 80.0);
        $l->setTemperature($lampada, 3200);
        $this->checar('setTemperature', (float) $lampada->light->temperature === 3200.0);
        $foco = $l->spawn('spot', ['name' => 'Holofote', 'position' => [4, 4, 0], 'rotation' => [-90, 0, 0], 'intensity' => 120, 'range' => 16, 'innerAngle' => 20, 'outerAngle' => 35, 'color' => '#ffffff']);
        $this->checar('spot', $foco->light->type === 'spot');
        $convertido = $l->convert($foco, 'disc');
        $this->checar('light.convert', $convertido->type === 'disc' && $foco->light->type === 'disc');
        $l->convert($foco, 'spot');
        $presets = $l->presets();
        $this->checar('light.presets', count($presets) > 0);
        if (count($presets) > 0) {
            $preset = $l->spawn($presets[0]->id, ['name' => 'LuzPreset', 'position' => [-4, 2.5, 4]]);
            $this->checar('light.fromPreset', $preset->light !== null && $l->fromPreset($presets[0]->id)->type === $presets[0]->type);
        }
        $this->checar('light.all', count($l->all(['local' => true])) >= 2);
        $this->checar('effectiveRange', (float) $l->effectiveRange($lampada) > 0);
        $this->checar('light.isLocal', $l->isLocal($lampada) === true);
        $this->checar('temperatureToColor', $l->temperatureToColor(6500) !== null);
        $l->setColor($lampada, '#ffffff');
        $this->checar('light.setColor', $h->math->vec3->equals($lampada->light->color, [1, 1, 1], 0.01));
    }

    private function ceu(): void
    {
        $h = $this->helix;
        $sky = $h->sky;
        $sky->set(['timeOfDay' => 10.5, 'haze' => 0.3, 'clouds' => ['enabled' => true, 'coverage' => 0.45]]);
        $this->checar('sky.set', self::aprox((float) $sky->timeOfDay, 10.5) && $sky->clouds->enabled === true);
        $this->checar('sky.isDay', $sky->isDay === true);
        $this->checar('sky.sunDirection', (float) $sky->sunDirection()->y > 0);
        $this->checar('sky.formatTimeOfDay', preg_match('/\\\\d{1,2}:\\\\d{2}/', (string) $sky->formatTimeOfDay(10.5)) === 1, $sky->formatTimeOfDay(10.5));
        $this->checar('sky.wrapTimeOfDay', (float) $sky->wrapTimeOfDay(25) === 1.0);
        $this->checar('sky.presets', count($sky->presets()) > 0);
        $this->assinar($sky->onHourChanged(function ($hora) use ($h): void {
            $h->log->info('Debug', "Hora do céu: {$hora}");
        }));
        $sky->cycleSpeed = 0;
        $this->checar('sky.cycleSpeed', (float) $sky->cycleSpeed === 0.0);
        $this->checar('world.gravity', (float) $h->world->gravity->y < 0);
        $h->world->wind->set(['speed' => 2, 'direction' => 45]);
        $this->checar('world.wind.set', (float) $h->world->wind->speed === 2.0);
    }

    private function camera(): void
    {
        $h = $this->helix;
        $c = $h->camera;
        $this->checar('camera.fov', (float) $c->fov > 0 && (float) $c->aspect > 0);
        $this->checar('camera.near/far', (float) $c->near > 0 && (float) $c->far > (float) $c->near);
        $this->checar('viewport', (float) $c->viewport->width > 0);
        $tela = $c->worldToScreen([0, 0, 0]);
        $this->checar('worldToScreen', $tela === null || is_numeric($tela->x));
        $raio = $c->screenToRay($c->viewport->width / 2, $c->viewport->height / 2);
        $this->checar('screenToRay', $raio === null || self::aprox((float) $h->math->vec3->length($raio->direction), 1, 0.01));
        $this->checar('viewMatrix', count($c->viewMatrix) === 16);
        $c->player->set(['distance' => 7, 'pitch' => 18]);
        $this->checar('player.set', (float) $c->player->settings->distance === 7.0);
        $this->checar('distanceTo', (float) $c->distanceTo([0, 0, 0]) >= 0);
        $this->checar('camera.position', $c->position !== null && $c->forward !== null);
        $this->assinar($c->onMainChanged(function ($e) use ($h): void {
            $h->log->info('Debug', 'Câmera principal: ' . ($e !== null ? $e->name : 'editor/jogador'));
        }));
    }

    private function pos(): void
    {
        $p = $this->helix->post;
        $this->checar('post.toneMappers', count($p->toneMappers()) > 0);
        $p->set([
            'bloom' => ['enabled' => true, 'intensity' => 0.5, 'threshold' => 1, 'softKnee' => 0.5, 'radius' => 0.6],
            'vignette' => ['enabled' => true, 'intensity' => 0.35, 'smoothness' => 0.5, 'roundness' => 1],
        ]);
        $this->checar('post.set', $p->bloom->enabled === true && $p->vignette->enabled === true);
        $p->exposure = 1.05;
        $this->checar('post.exposure', self::aprox((float) $p->exposure, 1.05));
        $p->toneMapper = 'agx';
        $this->checar('post.toneMapper', $p->toneMapper === 'agx');
        $this->checar('post.presets', count($p->presets()) > 0);
        $efeito = $p->custom->add(['fragment' => 'DebugPost', 'name' => 'DebugPost', 'uniforms' => ['tint' => [0.15, 0.05, 0.3], 'strength' => 0.6]]);
        $this->efeito = $efeito;
        $this->checar('post.custom.add', $efeito !== null && $p->custom->get('DebugPost') !== null);
        $efeito->uniforms->set('strength', 0.8);
        $this->checar('efeito.uniforms.list', count($efeito->uniforms->list()) >= 2);
    }

    private function render(): void
    {
        $r = $this->helix->render;
        $this->checar('render.passNames', count($r->passNames()) > 0);
        $this->checar('render.stats', is_numeric($r->stats->drawCalls));
        $this->checar('render.frame', is_numeric($r->frame->width));
        $this->assinar($r->onAfterFrame(function (): void {
            $this->renders++;
        }));
        $r->showGrid = false;
        $this->checar('render.showGrid', $r->showGrid === false);
        $this->checar('render.pixelRatio', (float) $r->pixelRatio > 0);
    }

                                                                                                         

    private function fisica(): void
    {
        $h = $this->helix;
        $ph = $h->physics;
        $this->checar('physics.enabled', $ph->enabled === true);
        $this->checar('physics.gravity', (float) $ph->gravity->y < 0);
        $this->checar('physics.settings', (float) $ph->settings->fixedTimestep > 0);
        for ($i = 1; $i <= 5; $i++) {
            $caixa = $h->scene->spawnPrimitive('box', ['name' => "Caixa{$i}", 'position' => [-2 + ($i - 1) * 1.1, 3 + ($i - 1) * 1.2, 3], 'rigidBody' => ['type' => 'dynamic', 'collider' => 'box', 'mass' => 2, 'restitution' => 0.3], 'tags' => ['caixa']]);
            $h->material->setColor($caixa, $h->math->color->hsl(30 + $i * 12, 0.7, 0.5));
        }
        $caixas = $h->scene->byTag('caixa');
        $this->checar('caixas dinâmicas', count($caixas) === 5 && $ph->hasBody($caixas[0]));
        $corpo = $ph->bodyOf($caixas[0]);
        $this->checar('bodyOf', $corpo->isDynamic === true && (float) $corpo->mass > 0);
        $corpo->applyImpulse([0, 2, 0]);
        $corpo->applyTorque([0, 1, 0]);
        $corpo->setMaterial(['friction' => 0.8]);
        $corpo->wake();
        $this->checar('body.linearVelocity', $corpo->linearVelocity !== null);
        $this->checar('bodies()', count($ph->bodies()) >= 6);
        $hit = $ph->raycast([0, 5, 0], [0, -1, 0], 20);
        $this->checar('physics.raycast', $hit !== null && $hit->entity !== null, $hit?->entity?->name);
        $this->checar('raycastAll', count($ph->raycastAll([0, 5, 0], [0, -1, 0], 20)) >= 1);
        $this->checar('overlapSphere', is_array($ph->overlapSphere([0, 3, 3], 4)));
        $this->checar('massProperties', (float) $ph->massProperties($caixas[0])->mass > 0);
        $this->checar('colliderVolume', (float) $ph->colliderVolume($caixas[0]) > 0);
        $this->checar('shapes.sphere volume', self::aprox((float) $ph->shapes->volume($ph->shapes->sphere(1)), 4.18879, 0.01));
        $this->assinar($ph->onCollisionBegin(function ($e) use ($h): void {
            $this->colisoes++;
            if ($this->colisoes <= 3) {
                $h->log->info('Debug', sprintf('Colisão: %s × %s (impulso %.2f)', $e->a->name, $e->b->name, (float) $e->contact->impulse));
            }
        }));
        $this->assinar($ph->onOutOfBounds(function ($e) use ($h): void {
            $h->log->warn('Debug', "{$e->name} caiu do mundo");
        }));
        $gatilho = $h->scene->spawn('group', ['name' => 'Gatilho', 'position' => [0, 1, 3], 'trigger' => ['shape' => 'box', 'size' => [3, 2, 3]]]);
        $this->checar('trigger spawn', $gatilho !== null && $h->scene->isAttached($gatilho));
        $this->checar('physics.stats', is_numeric($ph->stats->bodies));
    }

    private function personagem(): void
    {
        $h = $this->helix;
        $heroi = $h->character->spawn(['name' => 'Heroi', 'position' => [0, 1.2, 8], 'character' => ['walkSpeed' => 4, 'runSpeed' => 7, 'jumpHeight' => 1.4]]);
        $this->heroi = $heroi;
        $this->checar('character.spawn', $heroi->character !== null && $h->character->has($heroi));
        $c = $h->character->of($heroi);
        $this->checar('character.of', is_bool($c->isGrounded));
        $this->checar('settingsOf', (float) $h->character->settingsOf($heroi)->walkSpeed === 4.0);
        $h->player->possess($heroi);
        $this->checar('player.possess', self::mesmo($h->player->possessed, $heroi) && $h->player->isPossessing === true);
        $this->assinar($h->character->onJumped(function ($e) use ($h): void {
            $h->log->info('Debug', "{$e->entity->name} pulou");
        }));
        $this->assinar($h->player->onPossessed(function ($e) use ($h): void {
            $h->log->info('Debug', 'Possuindo ' . ($e !== null ? $e->name : 'ninguém'));
        }));
        $this->checar('character.all', count($h->character->all()) >= 1);
        $this->checar('player.spawnPoint', $h->player->spawnPoint !== null);
        $this->checar('character.velocity', $c->velocity !== null && $c->position !== null);
    }

    private function terreno(): void
    {
        $te = $this->helix->terrain;
        $this->checar('terrain.presets', count($te->presets()) > 0);
        $colinas = $te->spawn(['name' => 'Colinas', 'size' => 48, 'resolution' => 65, 'preset' => 'hills', 'seed' => 7, 'position' => [0, -6, -70]]);
        $this->checar('terrain.spawn', $colinas->terrain !== null && count($te->all()) >= 1);
        $this->checar('terrain.of', (int) $te->of($colinas)->resolution === 65);
        $altura = $te->heightAt([0, 0, -70], $colinas);
        $this->checar('heightAt', $altura !== null && is_numeric($altura), $altura);
        $this->checar('contains', $te->contains([0, 0, -70], $colinas) && !$te->contains([500, 0, 0], $colinas));
        $te->sculpt($colinas, 'raise', [5, 0, -70], ['radius' => 6, 'strength' => 1], 1);
        $te->markDirty($colinas);
        $te->grass->set($colinas, ['enabled' => true, 'density' => 0.5]);
        $this->checar('grass.set', $te->grass->settingsOf($colinas)->enabled === true);
        $te->water->set($colinas, ['enabled' => true, 'level' => -2]);
        $this->checar('water.set', $te->water->settingsOf($colinas)->enabled === true);
        $this->checar('terrain.raycast', $te->raycast([0, 50, -70], [0, -1, 0], $colinas) !== null);
    }

                                                                                                        

    private function interfaceGrafica(): \\Generator
    {
        $h = $this->helix;
        $g = $h->gui;
        $g->css('DebugEstilo');
        $hud = $g->html('DebugHud', ['id' => 'debug-hud']);
        $this->checar('gui.html', $hud !== null && $g->element('#debug-hud') !== null);
        $icone = $g->svg('DebugIcone', ['id' => 'debug-icone']);
        $this->checar('gui.svg', $icone !== null);
        $slot = $g->element('[data-slot=icone]');
        if ($slot !== null && $icone !== null) {
            $slot->appendChild($icone);
        }
        $this->checar('gui.bind', (int) $g->bind('linguagem', self::LINGUAGEM) >= 1);
        $g->bind('titulo', 'Helix · Debug');
        $this->assinar($g->onAction('caixa', function (): void {
            $this->soltarCaixa();
        }));
        $this->assinar($g->onAction('reiniciar', function () use ($h): void {
            $h->play->restart();
        }));
        $this->checar('gui.elements', count($g->elements('[data-bind]')) >= 5);
        $this->checar('gui.size', (float) $g->size->width > 0);
        $tela = $g->create('DebugTela', ['referenceSize' => ['x' => 1280, 'y' => 720]]);
        $painel = $g->add($tela, 'frame', ['name' => 'Painel', 'rect' => ['position' => ['x' => ['scale' => 1, 'offset' => -236], 'y' => ['scale' => 0, 'offset' => 16]], 'size' => ['x' => ['scale' => 0, 'offset' => 220], 'y' => ['scale' => 0, 'offset' => 48]]]]);
        $g->add($tela, 'text', ['name' => 'Rotulo', 'text' => 'Tela declarativa OK'], $painel->node->id);
        $this->checar('gui.add/find', $g->find($tela, 'Rotulo')->kind === 'text');
        $g->setText($tela, 'Rotulo', 'Tela declarativa OK · ' . self::LINGUAGEM);
        $this->tela = yield $g->show($tela, 'debug-tela');
        $this->checar('gui.show/isShown', $this->tela !== null && $g->isShown($this->tela));
        $this->checar('gui.kinds', in_array('button', $g->kinds(), true));
    }

    private function audio(): void
    {
        $h = $this->helix;
        $a = $h->audio;
        $this->checar('audio.supported', is_bool($a->supported));
        $a->mixer->setVolumeDb('sfx', -3);
        $this->checar('mixer.setVolumeDb', (float) $a->mixer->bus('sfx')->volumeDb === -3.0);
        $this->checar('audio.clips', is_array($a->clips()));
        $fonte = $h->scene->spawn('sound', ['name' => 'FonteSonora', 'position' => [3, 1, 3], 'audioSource' => ['trigger' => 'manual', 'spatial' => true]]);
        $this->checar('spawn sound', $fonte->audioSource !== null);
        $a->sources->set($fonte, ['volumeDb' => -4]);
        $this->checar('sources.set', (float) $fonte->audioSource->volumeDb === -4.0);
        $this->checar('sources.isPlaying', $a->sources->isPlaying($fonte) === false);
    }

    private function vfx(): \\Generator
    {
        $v = $this->helix->vfx;
        $ids = $v->templates->ids();
        $this->checar('vfx.templates', count($ids) > 0);
        $this->checar('vfx.moduleKinds', count($v->moduleKinds()) > 0);
        $doc = $v->fromTemplate($ids[0], 'DebugFaiscas');
        $doc = $v->addEmitter($doc, ['name' => 'Extra', 'maxParticles' => 50]);
        $doc = $v->set($doc, ['loop' => true]);
        $this->checar('vfx.fromTemplate/addEmitter', count($doc->emitters) >= 2 && $doc->loop === true);
        $ativo = yield $v->save($doc, 'DebugFaiscas');
        $this->checar('vfx.save', $ativo !== null && $ativo->kind === 'vfx');
        $ator = $v->emitAt($ativo, [0, 1.5, -8], ['destroyWhenFinished' => false]);
        $this->checar('vfx.emitAt', $v->has($ator) === true);
        $v->burst($ator, 20);
        $this->checar('vfx.stats', is_numeric($v->stats()->effects));
    }

                                                                                                        

    private function soltarCaixa(): void
    {
`;
}

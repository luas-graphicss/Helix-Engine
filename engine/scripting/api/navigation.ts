import * as mat4 from '@/engine/core/math/mat4';
import * as vec3 from '@/engine/core/math/vec3';
import type { Vec3 } from '@/engine/core/math/vec3';
import { Entity } from '@/engine/core/scene/entity';
import type { NavAgent } from '@/engine/navigation/agent/nav-agent';
import { ALL_AREAS_MASK, areaBit, clampAreaMask } from '@/engine/navigation/areas/nav-areas';
import type { NavPath } from '@/engine/navigation/path/nav-path';
import type { NavigationSystem } from '@/engine/navigation/scene/navigation-system';
import type { RuntimeHost } from '../runtime/runtime-host';
import { HelixArgumentError, HelixError } from '../runtime/script-errors';
import { copyVec3, optionalNumber, requireEntity, requireNumber, requireString, toVec3 } from '../runtime/values';
const ARRIVED_EVENT = 'navigation.arrived';
const DEFAULT_SAMPLE_DISTANCE = 2;
function describePath(path: NavPath) {
    return { status: path.status, corners: path.corners.map((corner) => copyVec3(corner)), length: path.length };
}
export function createNavigationApi(host: RuntimeHost) {
    const { session } = host;
    const { scene } = session;
    const wrappers = new WeakMap<NavAgent, object>();
    function attach(): NavigationSystem | null {
        const navigation = session.playtest.ensureNavigation();
        if (navigation && !navigation.onArrived)
            navigation.onArrived = (entity) => host.bus.emit(ARRIVED_EVENT, entity);
        return navigation;
    }
    function runtime(member: string): NavigationSystem {
        const navigation = attach();
        if (!navigation)
            throw new HelixError(`${member}: a navegação só existe com a simulação em andamento.`);
        return navigation;
    }
    function agentOf(value: unknown, member: string): NavAgent {
        const entity = requireEntity(value, member);
        const agent = runtime(member).ensureAgent(entity);
        if (!agent)
            throw new HelixArgumentError(member, `${entity.name} não é um agente de navegação (precisa do componente navAgent).`);
        return agent;
    }
    function pointOf(value: unknown, member: string): Vec3 {
        return value instanceof Entity ? mat4.getTranslation(vec3.create(), value.worldMatrix) : toVec3(value, member);
    }
    function areaIndex(value: unknown, member: string): number {
        const name = requireString(value, member, 'o nome da área');
        const index = scene.navigation.areas.findIndex((area) => area.name === name);
        if (index < 0)
            throw new HelixArgumentError(member, `não existe área de navegação chamada "${name}".`);
        return index;
    }
    function wrap(agent: NavAgent) {
        const cached = wrappers.get(agent);
        if (cached)
            return cached;
        const wrapper = {
            get entity() {
                return scene.findById(agent.id);
            },
            get settings() {
                return agent.settings;
            },
            get position() {
                return agent.position;
            },
            get velocity() {
                return agent.velocity;
            },
            get destination() {
                return agent.hasDestination ? agent.destination : null;
            },
            get hasPath() {
                return agent.path !== null && agent.path.status !== 'invalid';
            },
            get pathStatus() {
                return agent.path?.status ?? 'invalid';
            },
            get corners() {
                return agent.path ? agent.path.corners.slice(agent.cornerIndex).map((corner) => copyVec3(corner)) : [];
            },
            get remainingDistance() {
                return agent.remainingDistance;
            },
            get isOnNavMesh() {
                return agent.isOnNavMesh;
            },
            get isOnLink() {
                return agent.isOnLink;
            },
            get hasArrived() {
                return agent.hasArrived;
            },
            get isStopped() {
                return agent.isStopped;
            },
            set isStopped(value: boolean) {
                agent.isStopped = Boolean(value);
            },
            setDestination: (target: unknown) => agent.setDestination(pointOf(target, 'navigation.agent.setDestination')),
            stop: () => {
                agent.isStopped = true;
            },
            resume: () => {
                agent.isStopped = false;
            },
            resetPath: () => agent.resetPath(),
            warp: (point: unknown) => runtime('navigation.agent.warp').world.warp(agent, toVec3(point, 'navigation.agent.warp')),
        };
        wrappers.set(agent, wrapper);
        return wrapper;
    }
    return {
        get isReady() {
            return session.playtest.navigation !== null;
        },
        agent: (value: unknown) => wrap(agentOf(value, 'helix.navigation.agent')),
        hasAgent: (value: unknown) => requireEntity(value, 'helix.navigation.hasAgent').navAgent !== null,
        agents: () => runtime('helix.navigation.agents').world.agents.map(wrap),
        setDestination: (value: unknown, target: unknown) => {
            const member = 'helix.navigation.setDestination';
            agentOf(value, member).setDestination(pointOf(target, member));
        },
        stop: (value: unknown) => {
            agentOf(value, 'helix.navigation.stop').isStopped = true;
        },
        findPath: (start: unknown, end: unknown, areaMask?: unknown) => {
            const member = 'helix.navigation.findPath';
            const mask = areaMask === undefined ? ALL_AREAS_MASK : clampAreaMask(requireNumber(areaMask, member, 'a máscara de áreas'));
            return describePath(runtime(member).world.findPath(toVec3(start, member), toVec3(end, member), mask));
        },
        samplePosition: (point: unknown, maxDistance?: unknown) => {
            const member = 'helix.navigation.samplePosition';
            const sampled = vec3.create();
            const reach = optionalNumber(maxDistance, DEFAULT_SAMPLE_DISTANCE, member, 'a distância máxima');
            return runtime(member).world.samplePosition(sampled, toVec3(point, member), reach) ? sampled : null;
        },
        rebuild: () => runtime('helix.navigation.rebuild').build(),
        areas: () => scene.navigation.areas.map((area, index) => ({ index, name: area.name, cost: area.cost })),
        areaMask: (...names: unknown[]) => names.reduce<number>((mask, name) => mask | areaBit(areaIndex(name, 'helix.navigation.areaMask')), 0),
        onArrived: (handler: unknown) => {
            attach();
            return host.bus.on(ARRIVED_EVENT, handler as (payload: unknown) => void, host.current);
        },
    };
}

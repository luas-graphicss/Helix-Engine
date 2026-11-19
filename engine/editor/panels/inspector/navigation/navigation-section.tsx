'use client';
import type { Entity } from '@/engine/core/scene/entity';
import { NavAddSection } from './nav-add-section';
import { NavAgentSection } from './nav-agent-section';
import { NavAreasSection } from './nav-areas-section';
import { NavLinkSection } from './nav-link-section';
import { NavModifierSection } from './nav-modifier-section';
import { NavObstacleSection } from './nav-obstacle-section';
import { NavSurfaceSection } from './nav-surface-section';
export function NavigationSection({ entity }: {
    entity: Entity;
}) {
    const { navSurface, navAgent, navObstacle, navLink, navModifier } = entity;
    return (<>
      {navSurface && <NavSurfaceSection entity={entity} settings={navSurface}/>}
      {navSurface && <NavAreasSection />}
      {navAgent && <NavAgentSection entity={entity} settings={navAgent}/>}
      {navObstacle && <NavObstacleSection entity={entity} settings={navObstacle}/>}
      {navLink && <NavLinkSection entity={entity} settings={navLink}/>}
      {navModifier && <NavModifierSection entity={entity} settings={navModifier}/>}
      <NavAddSection entity={entity}/>
    </>);
}

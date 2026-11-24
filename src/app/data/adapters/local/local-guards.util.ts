import { assertCan, UnauthenticatedError, type Permission } from '../../../domain';
import type { Actor, ActorContext } from '../../ports/actor-context.port';

/** Server-side style authorization for local adapters (UI hiding is never access control). */
export function requireActor(ctx: ActorContext, permission: Permission): Actor {
  const actor = ctx.actor();
  if (!actor) throw new UnauthenticatedError('You must be signed in.');
  assertCan(actor.role, permission);
  return actor;
}

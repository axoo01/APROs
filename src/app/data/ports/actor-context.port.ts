import type { Id, Role } from '../../domain';

export interface Actor {
  readonly userId: Id;
  readonly role: Role;
}

/**
 * Who is performing a command. Implemented by the auth layer.
 * Local adapters use it to enforce permissions exactly like the REST API will (403s).
 */
export abstract class ActorContext {
  abstract actor(): Actor | null;
}

import type { Entity } from '@lastolivegames/becsy';
import type { API } from '../API';
import type { SerializedNode } from '../types/serialized-node';

/** Read-only lookup state for one synchronous plan; never reuse across frames. */
export function nodeLookupForPass(api: API) {
  const create = () => ({
    nodes: api.getNodes(),
    commands: api.getEntityCommands().entries(),
    owners: new Map<Entity['__id'], { owner: Entity; id: string }>(),
    nodesById: new Map<string, SerializedNode>(),
    nodeCursor: 0,
    commandsDone: false,
  });
  let state: ReturnType<typeof create> | undefined;
  return (entity: Entity): SerializedNode | undefined => {
    if (!entity) return undefined;
    try {
      state ??= create();
      // Index only the prefix requested so far. Sparse views need not scan the
      // whole document, while a dense plan visits each mapping/node at most once.
      while (!state.owners.has(entity.__id) && !state.commandsDone) {
        const next = state.commands.next();
        if (next.done) {
          state.commandsDone = true;
          break;
        }
        const [id, commands] = next.value;
        const owner = commands.id();
        if (!state.owners.has(owner.__id))
          state.owners.set(owner.__id, { owner, id });
      }
      const match = state.owners.get(entity.__id);
      if (!match) return undefined;
      // Preserve held/transient validation and unusual identity adapters.
      if (!match.owner.isSame(entity)) return api.getNodeByEntity(entity);
      while (
        !state.nodesById.has(match.id) &&
        state.nodeCursor < state.nodes.length
      ) {
        const node = state.nodes[state.nodeCursor++];
        if (!state.nodesById.has(node.id)) state.nodesById.set(node.id, node);
      }
      // Preserve first-match semantics, including a missing first alias target.
      return state.nodesById.get(match.id);
    } catch (error) {
      // An iterator may have advanced before a failed read. Retry from fresh
      // inputs rather than exposing a partially initialized snapshot.
      state = undefined;
      throw error;
    }
  };
}

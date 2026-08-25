import type {AncestryNode, Species} from "./game-model";

export type LineageNodeKind = AncestryNode["kind"] | "next";

export type LineageNode = {
  graphId: string;
  nodeId: string;
  speciesId: string;
  owner: string;
  kind: LineageNodeKind;
  parentIds: string[];
  node: AncestryNode | null;
};

export type AncestrySelection = {
  speciesId: string;
  nodeId: string;
};

export function buildLineageNodes(
  species: Species,
  includeBlankTip = species.alive,
): LineageNode[] {
  const nodes: LineageNode[] = species.nodes.map((node) => ({
    graphId: node.nodeId,
    nodeId: node.nodeId,
    speciesId: species.speciesId,
    owner: species.owner,
    kind: node.kind,
    parentIds: [...node.parentNodeIds],
    node,
  } satisfies LineageNode));
  if (includeBlankTip) {
    nodes.push({
      graphId: `${species.speciesId}:next`,
      nodeId: "next",
      speciesId: species.speciesId,
      owner: species.owner,
      kind: "next",
      parentIds: [species.currentNodeId],
      node: null,
    });
  }
  return nodes;
}

export function parentCount(node: LineageNode): number {
  return node.parentIds.length;
}

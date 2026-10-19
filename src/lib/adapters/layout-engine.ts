// The engine behind the Diagram's LayoutEngine port, on dagre. This is the only
// file that imports @dagrejs/dagre: swapping the engine rewrites this file, and
// the port, its callers and their tests stay as they are.
import { Graph, layout, type EdgeLabel, type GraphLabel, type NodeLabel } from "@dagrejs/dagre";

import type { LayoutEngine, LayoutRequest, Placement } from "@/lib/services/diagram";

const RANK_DIRECTION: Record<LayoutRequest["direction"], GraphLabel["rankdir"]> = { "left-to-right": "LR" };

export const layoutEngine: LayoutEngine = (request) => {
  // A fresh graph per call: a reused one would keep nodes and edges deleted since the last layout.
  const graph = new Graph<GraphLabel, NodeLabel, EdgeLabel>();
  graph.setGraph({
    rankdir: RANK_DIRECTION[request.direction],
    ranksep: request.rankSeparation,
    nodesep: request.nodeSeparation,
  });
  graph.setDefaultEdgeLabel(() => ({}));
  // dagre's result depends on insertion order, so nodes and edges go in in request order.
  for (const node of request.nodes) graph.setNode(node.id, { width: node.width, height: node.height });
  for (const { source, target } of request.edges) graph.setEdge(source, target);
  layout(graph);

  // dagre answers with the node's centre; the port speaks top-left. A node
  // dagre did not position is left out, and layoutDiagram refuses the result.
  return new Map(
    request.nodes.flatMap((node): [string, Placement][] => {
      const { x, y } = graph.node(node.id);
      return x === undefined || y === undefined ? [] : [[node.id, { x: x - node.width / 2, y: y - node.height / 2 }]];
    }),
  );
};

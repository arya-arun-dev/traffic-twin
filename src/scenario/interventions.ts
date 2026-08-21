import type {
  RoadEdge,
  RoadGraph,
} from '../model/graph';

import {
  getEdgePhysicalSegmentKey,
} from '../application/roadIdentity';


/*
 * Produces a scenario-specific view of the core graph.
 *
 * RoadEdge objects themselves are not modified or copied.
 * We create only a new adjacency index that omits edges whose
 * physical segment is closed.
 *
 * graph.ts therefore remains completely unaware of interventions.
 */
export function createGraphWithClosures(
  graph: RoadGraph,
  closedSegmentKeys:
    ReadonlySet<string>
): RoadGraph {

  if (
    closedSegmentKeys.size === 0
  ) {
    return graph;
  }

  const adjacency =
    new Map<
      number,
      RoadEdge[]
    >();


  for (
    const [
      nodeId,
      outgoingEdges,
    ]
    of graph.adjacency
  ) {

    const availableEdges =
      outgoingEdges.filter(
        edge =>
          !closedSegmentKeys.has(
            getEdgePhysicalSegmentKey(
              edge
            )
          )
      );

    if (
      availableEdges.length > 0
    ) {

      adjacency.set(
        nodeId,
        availableEdges
      );
    }
  }


  return {
    nodes:
      graph.nodes,

    adjacency,
  };
}

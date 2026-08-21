import type {
  RoadEdge,
} from '../model/graph';


/*
 * Application-level identity for a physical road segment.
 *
 * The simulation graph remains directed:
 *
 *   A -> B
 *   B -> A
 *
 * For road selection / closure UI, both directions belong to
 * the same physical segment, so the smaller node ID is always
 * placed first.
 *
 * This is intentionally NOT part of RoadEdge. The traffic
 * simulation does not need a physical-segment display identity.
 */
export function getPhysicalSegmentKey(
  fromNodeId: number,
  toNodeId: number
): string {

  const first =
    Math.min(
      fromNodeId,
      toNodeId
    );

  const second =
    Math.max(
      fromNodeId,
      toNodeId
    );

  return `${first}-${second}`;
}


export function getEdgePhysicalSegmentKey(
  edge: RoadEdge
): string {

  return getPhysicalSegmentKey(
    edge.from,
    edge.to
  );
}

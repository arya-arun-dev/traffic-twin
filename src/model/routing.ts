import {
  distanceMeters,
} from './graph';

import type {
  RoadEdge,  
  RoadGraph,
} from './graph';

const HEURISTIC_SPEED_MPS = 40;

type QueueItem = {
  nodeId: number;
  priority: number;
};


class MinPriorityQueue {

  private heap: QueueItem[] = [];


  isEmpty(): boolean {
    return this.heap.length === 0;
  }


  push(item: QueueItem): void {

    this.heap.push(item);

    let index =
      this.heap.length - 1;

    while (index > 0) {

      const parentIndex =
        Math.floor(
          (index - 1) / 2
        );

      if (
        this.heap[parentIndex].priority
        <= item.priority
      ) {
        break;
      }

      this.heap[index] =
        this.heap[parentIndex];

      index =
        parentIndex;
    }

    this.heap[index] =
      item;
  }


  pop(): QueueItem | undefined {

    if (
      this.heap.length === 0
    ) {
      return undefined;
    }

    const minimum =
      this.heap[0];

    const last =
      this.heap.pop()!;

    if (
      this.heap.length === 0
    ) {
      return minimum;
    }

    let index = 0;

    while (true) {

      const leftChild =
        index * 2 + 1;

      const rightChild =
        index * 2 + 2;

      if (
        leftChild
        >= this.heap.length
      ) {
        break;
      }

      let smallerChild =
        leftChild;

      if (
        rightChild
        < this.heap.length
        &&
        this.heap[rightChild].priority
        <
        this.heap[leftChild].priority
      ) {
        smallerChild =
          rightChild;
      }

      if (
        this.heap[smallerChild].priority
        >= last.priority
      ) {
        break;
      }

      this.heap[index] =
        this.heap[smallerChild];

      index =
        smallerChild;
    }

    this.heap[index] =
      last;

    return minimum;
  }
}


export function findRoute(
  graph: RoadGraph,
  startNodeId: number,
  destinationNodeId: number
): RoadEdge[] {

  if (
    startNodeId
    === destinationNodeId
  ) {
    return [];
  }

  const destination =
  graph.nodes.get(destinationNodeId)!;

  const queue =
    new MinPriorityQueue();

  /*
   * Best known actual travel time
   * from the start node to each node.
   */
  const gScore =
    new Map<number, number>();

    gScore.set(
    startNodeId,
    0
    );

  /*
   * Stores the previous edge in the
   * best currently known path.
   */
  const cameFrom =
    new Map<number, RoadEdge>();

  /*
   * Nodes that have already been
   * fully explored.
   */
  const closedSet =
    new Set<number>();

  queue.push({
    nodeId: startNodeId,
    priority: 0,
  });


  while (!queue.isEmpty()) {

    const current =
      queue.pop()!;

    /*
     * A node may have an older,
     * higher-cost copy still sitting
     * in the queue.
     */
    if (
      closedSet.has(
        current.nodeId
      )
    ) {
      continue;
    }

    /*
     * Destination reached. Reconstruct sequence of RoadEdge
     */
    if (
      current.nodeId
      === destinationNodeId
    ) {

      const route: RoadEdge[] = [];

      let nodeId =
        destinationNodeId;

    while (
        nodeId
        !== startNodeId
      ) {

        const edge =
          cameFrom.get(
            nodeId
          )!;

        route.push(
          edge
        );

        /*
         * The edge tells us which
         * node we came from.
         */
        nodeId =
          edge.from;
      }

      route.reverse();

      return route;
    }

    /*
     * We are now fully exploring
     * this node.
     */
    closedSet.add(
      current.nodeId
    );

    const outgoingEdges =
      graph.adjacency.get(
        current.nodeId
      )
      ?? [];

    for (
      const edge
      of outgoingEdges
    ) {

      /*
       * No reason to consider a node
       * that has already been fully
       * explored.
       */
      if (
        closedSet.has(
          edge.to
        )
      ) {
        continue;
      }

      const edgeCostSeconds =
        edge.lengthMeters
        / edge.speedLimitMps;

      const tentativeGScore =
        gScore.get(
          current.nodeId
        )!
        +
        edgeCostSeconds;

      const previousGScore =
        gScore.get(
          edge.to
        )
        ?? Infinity;

      /*
       * Relax the edge.
       *
       * Only continue if this path
       * improves our best known cost
       * to the neighboring node.
       */
      if (
        tentativeGScore
        >= previousGScore
      ) {
        continue;
      }

      cameFrom.set(
        edge.to,
        edge
      );

      gScore.set(
        edge.to,
        tentativeGScore
      );

      const neighbor =
        graph.nodes.get(
          edge.to
        )!;

      const heuristic =
        distanceMeters(
          neighbor.latitude,
          neighbor.longitude,
          destination.latitude,
          destination.longitude
        )
        / HEURISTIC_SPEED_MPS;

      queue.push({
        nodeId:
          edge.to,

        priority:
          tentativeGScore
          + heuristic,
      });
    }
  }


  /*
   * No route exists.
   */
  return [];
}
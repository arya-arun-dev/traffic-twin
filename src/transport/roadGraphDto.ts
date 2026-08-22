import type {
  RoadEdge,
  RoadGraph,
  RoadNode,
} from '../model/graph';


export type RoadGraphNodeDto = {
  id: number;
  latitude: number;
  longitude: number;
};


export type RoadGraphEdgeDto = {
  from: number;
  to: number;
  lengthMeters: number;
  speedLimitMps: number;
};


export type RoadGraphDto = {
  nodes: RoadGraphNodeDto[];
  edges: RoadGraphEdgeDto[];
};


export function toRoadGraphDto(
  graph: RoadGraph
): RoadGraphDto {

  const edges:
    RoadGraphEdgeDto[] =
    [];


  for (
    const outgoingEdges
    of graph.adjacency.values()
  ) {

    for (
      const edge
      of outgoingEdges
    ) {

      edges.push({
        from:
          edge.from,
        to:
          edge.to,
        lengthMeters:
          edge.lengthMeters,
        speedLimitMps:
          edge.speedLimitMps,
      });
    }
  }


  return {
    nodes:
      Array.from(
        graph.nodes.values()
      )
        .map(
          node => ({
            id:
              node.id,
            latitude:
              node.latitude,
            longitude:
              node.longitude,
          })
        ),

    edges,
  };
}


export function fromRoadGraphDto(
  dto: RoadGraphDto
): RoadGraph {

  const nodes =
    new Map<number, RoadNode>();

  const adjacency =
    new Map<number, RoadEdge[]>();


  for (
    const nodeDto
    of dto.nodes
  ) {

    if (
      nodes.has(
        nodeDto.id
      )
    ) {

      throw new Error(
        `Road graph contains duplicate node ${nodeDto.id}.`
      );
    }


    nodes.set(
      nodeDto.id,
      {
        id:
          nodeDto.id,
        latitude:
          nodeDto.latitude,
        longitude:
          nodeDto.longitude,
      }
    );
  }


  for (
    const edgeDto
    of dto.edges
  ) {

    if (
      !nodes.has(
        edgeDto.from
      )
      ||
      !nodes.has(
        edgeDto.to
      )
    ) {

      throw new Error(
        `Road edge ${edgeDto.from}->${edgeDto.to} references an unknown node.`
      );
    }


    const edge:
      RoadEdge = {
      from:
        edgeDto.from,
      to:
        edgeDto.to,
      lengthMeters:
        edgeDto.lengthMeters,
      speedLimitMps:
        edgeDto.speedLimitMps,
    };


    let outgoingEdges =
      adjacency.get(
        edge.from
      );


    if (!outgoingEdges) {

      outgoingEdges =
        [];

      adjacency.set(
        edge.from,
        outgoingEdges
      );
    }


    /*
     * Each transported directed edge is materialized exactly once.
     * The same RoadEdge object is then used by adjacency, routes,
     * occupancy maps, and scenario graphs inside the simulation.
     */
    outgoingEdges.push(
      edge
    );
  }


  return {
    nodes,
    adjacency,
  };
}

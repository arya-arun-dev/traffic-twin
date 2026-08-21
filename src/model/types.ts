export type RoadNode = {

  id: number;

  latitude: number;

  longitude: number;

};

export type RoadEdge = {
  // from and to indicate RoadNode id
  from: number;
  to: number;

  lengthMeters: number;
  speedLimitMps: number;
};

export type RoadGraph = {
    nodes: Map<number, RoadNode>
    adjacency: Map<number, RoadEdge[]>;
}
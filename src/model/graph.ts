// graph.ts

import type {
  OsmResponse,
} from '../data/osm';

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
  nodes: Map<number, RoadNode>;
  adjacency: Map<number, RoadEdge[]>;
};

type WayDirection =
  | 'FORWARD'
  | 'REVERSE'
  | 'BOTH';

function getWayDirection(
  tags?: Record<string, string>
): WayDirection {

  const oneway =
    tags?.oneway;

  // Explicit forward one-way
  if (oneway === 'yes') {
    return 'FORWARD';
  }

  // Explicit reverse one-way
  if (oneway === '-1') {
    return 'REVERSE';
  }

  // Explicitly two-way
  if (oneway === 'no') {
    return 'BOTH';
  }

  // Implied one-way when no explicit oneway value overrides it
  if (
    tags?.highway === 'motorway'
    || tags?.junction === 'roundabout'
  ) {
    return 'FORWARD';
  }

  return 'BOTH';
}

export function buildRoadGraph(
  osm: OsmResponse
): RoadGraph {

  const nodes =
    new Map<number, RoadNode>();

  const adjacency =
    new Map<number, RoadEdge[]>();

  /*
   * First pass:
   * Build our RoadNode lookup from the
   * OSM node elements.
   */
  for (const element of osm.elements) {

    if (element.type !== 'node') {
      continue;
    }

    nodes.set(
      element.id,
      {
        id: element.id,
        latitude: element.lat,
        longitude: element.lon,
      }
    );
  }

  /*
   * Second pass:
   * Convert each OSM way into directed
   * RoadEdges between consecutive nodes.
   */
  for (const element of osm.elements) {

    if (element.type !== 'way') {
      continue;
    }

    const direction =
      getWayDirection(
        element.tags
      );

    const speedLimitMps =
      getSpeedLimitMps(
        element.tags
      );

    for (
      let i = 0;
      i < element.nodes.length - 1;
      i++
    ) {

      const firstNodeId =
        element.nodes[i];

      const secondNodeId =
        element.nodes[i + 1];

      const firstNode =
        nodes.get(firstNodeId)!;

      const secondNode =
        nodes.get(secondNodeId)!;

      const lengthMeters =
        distanceMeters(
          firstNode.latitude,
          firstNode.longitude,
          secondNode.latitude,
          secondNode.longitude
        );

      /*
       * OSM way direction:
       *
       * firstNodeId → secondNodeId
       *
       * FORWARD means traffic follows
       * that ordering.
       */
      if (
        direction === 'FORWARD'
        || direction === 'BOTH'
      ) {

        const edge: RoadEdge = {
          from: firstNodeId,
          to: secondNodeId,
          lengthMeters,
          speedLimitMps,
        };

        if (
          !adjacency.has(firstNodeId)
        ) {
          adjacency.set(
            firstNodeId,
            []
          );
        }

        adjacency
          .get(firstNodeId)!
          .push(edge);
      }

      /*
       * REVERSE means traffic travels
       * opposite to the OSM way ordering.
       *
       * BOTH creates this reverse edge
       * in addition to the forward edge.
       */
      if (
        direction === 'REVERSE'
        || direction === 'BOTH'
      ) {

        const reverseEdge: RoadEdge = {
          from: secondNodeId,
          to: firstNodeId,
          lengthMeters,
          speedLimitMps,
        };

        if (
          !adjacency.has(secondNodeId)
        ) {
          adjacency.set(
            secondNodeId,
            []
          );
        }

        adjacency
          .get(secondNodeId)!
          .push(reverseEdge);
      }
    }
  }

  return {
    nodes,
    adjacency,
  };
}

export function distanceMeters(
  latitude1: number,
  longitude1: number,
  latitude2: number,
  longitude2: number
): number {

  const earthRadiusMeters =
    6_371_000;

  const toRadians = (
    degrees: number
  ) =>
    degrees * Math.PI / 180;

  const lat1 =
    toRadians(latitude1);

  const lat2 =
    toRadians(latitude2);

  const deltaLatitude =
    toRadians(
      latitude2 - latitude1
    );

  const deltaLongitude =
    toRadians(
      longitude2 - longitude1
    );

  const a =
    Math.sin(deltaLatitude / 2) ** 2
    +
    Math.cos(lat1)
    * Math.cos(lat2)
    * Math.sin(deltaLongitude / 2) ** 2;

  const c =
    2 * Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a)
    );

  return earthRadiusMeters * c;
}

export function getSpeedLimitMps(
  tags?: Record<string, string>
): number {

  const maxspeed =
    tags?.maxspeed;

  if (maxspeed) {

    const value =
      parseFloat(maxspeed);

    if (
      maxspeed.toLowerCase().includes('mph')
    ) {
      return value * 0.44704;
    }

    // OSM numeric maxspeed values without a unit
    // are interpreted as km/h.
    return value / 3.6;
  }

  return getDefaultSpeedMps(
    tags?.highway
  );
}


function getDefaultSpeedMps(
  highwayType?: string
): number {

  switch (highwayType) {

    case 'motorway':
      return 65 * 0.44704;

    case 'motorway_link':
      return 45 * 0.44704;

    case 'trunk':
      return 55 * 0.44704;

    case 'trunk_link':
      return 40 * 0.44704;

    case 'primary':
      return 45 * 0.44704;

    case 'primary_link':
      return 35 * 0.44704;

    case 'secondary':
      return 40 * 0.44704;

    case 'secondary_link':
      return 30 * 0.44704;

    case 'tertiary':
      return 35 * 0.44704;

    case 'tertiary_link':
      return 30 * 0.44704;

    case 'residential':
      return 25 * 0.44704;

    case 'living_street':
      return 15 * 0.44704;

    case 'unclassified':
      return 30 * 0.44704;

    default:
      return 30 * 0.44704;
  }
}
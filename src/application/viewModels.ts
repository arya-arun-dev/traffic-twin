import type {
  RoadGraph,
} from '../model/graph';

import type {
  Vehicle,
} from '../model/idm';

import type {
  EdgeOccupancy,
} from '../model/simulation';

import {
  getEdgePhysicalSegmentKey,
} from './roadIdentity';


export type VehicleView = {
  id: number;
  longitude: number;
  latitude: number;

  /*
   * UI-only normalized speed:
   *
   * 0 = stopped
   * 1 = at or above the current road speed limit
   *
   * This value is used only for map coloring.
   */
  speedRatio: number;
};


export type RoadSpeedView = {
  segmentKey: string;
  activeVehicles: number;

  /*
   * Mean vehicle speed / mean applicable speed limit
   * for vehicles currently occupying this physical segment.
   *
   * Visualization only. It is not used by routing or IDM.
   */
  averageSpeedRatio: number;
};


export type RoadSelection = {
  segmentKey: string;
  displayName: string;
  speedLimitMps: number;
};


export class VehicleIdentityRegistry {

  private readonly ids =
    new WeakMap<
      Vehicle,
      number
    >();

  private nextId =
    1;


  getId(
    vehicle: Vehicle
  ): number {

    const existing =
      this.ids.get(
        vehicle
      );

    if (existing) {
      return existing;
    }

    const id =
      this.nextId++;

    this.ids.set(
      vehicle,
      id
    );

    return id;
  }
}


function clamp01(
  value: number
): number {

  return Math.max(
    0,
    Math.min(
      1,
      value
    )
  );
}


/*
 * Converts simulation state into browser-map coordinates.
 *
 * This is a projection of the model, not part of the model.
 * RoadEdge remains unaware of GeoJSON, MapLibre, and rendering.
 */
export function buildVehicleViews(
  graph: RoadGraph,
  occupancy: EdgeOccupancy,
  identityRegistry:
    VehicleIdentityRegistry
): VehicleView[] {

  const result:
    VehicleView[] =
    [];


  for (
    const [
      edge,
      vehicles,
    ]
    of occupancy
  ) {

    const fromNode =
      graph.nodes.get(
        edge.from
      );

    const toNode =
      graph.nodes.get(
        edge.to
      );

    if (
      !fromNode
      ||
      !toNode
    ) {
      continue;
    }


    for (
      const vehicle
      of vehicles
    ) {

      const progressRatio =
        edge.lengthMeters <= 0
        ? 0
        : clamp01(
            vehicle.positionMeters
            /
            edge.lengthMeters
          );

      const longitude =
        fromNode.longitude
        +
        (
          toNode.longitude
          - fromNode.longitude
        )
        * progressRatio;

      const latitude =
        fromNode.latitude
        +
        (
          toNode.latitude
          - fromNode.latitude
        )
        * progressRatio;

      const speedRatio =
        edge.speedLimitMps <= 0
        ? 0
        : clamp01(
            vehicle.speedMps
            /
            edge.speedLimitMps
          );

      result.push({
        id:
          identityRegistry
            .getId(
              vehicle
            ),

        longitude,

        latitude,

        speedRatio,
      });
    }
  }


  return result;
}


/*
 * Derives a road-color overlay from the current microscopic state.
 *
 * Again, this never feeds back into the simulation. Routing still
 * uses free-flow edge cost and IDM still reads the core RoadEdge.
 */
export function buildRoadSpeedViews(
  occupancy: EdgeOccupancy
): RoadSpeedView[] {

  type Aggregate = {
    activeVehicles: number;
    speedRatioTotal: number;
  };

  const aggregates =
    new Map<
      string,
      Aggregate
    >();


  for (
    const [
      edge,
      vehicles,
    ]
    of occupancy
  ) {

    if (
      vehicles.length === 0
    ) {
      continue;
    }

    const segmentKey =
      getEdgePhysicalSegmentKey(
        edge
      );

    let aggregate =
      aggregates.get(
        segmentKey
      );

    if (!aggregate) {

      aggregate = {
        activeVehicles: 0,
        speedRatioTotal: 0,
      };

      aggregates.set(
        segmentKey,
        aggregate
      );
    }


    for (
      const vehicle
      of vehicles
    ) {

      const speedRatio =
        edge.speedLimitMps <= 0
        ? 0
        : clamp01(
            vehicle.speedMps
            /
            edge.speedLimitMps
          );

      aggregate
        .activeVehicles++;

      aggregate
        .speedRatioTotal
        += speedRatio;
    }
  }


  return Array.from(
    aggregates,
    (
      [
        segmentKey,
        aggregate,
      ]
    ) => ({
      segmentKey,

      activeVehicles:
        aggregate
          .activeVehicles,

      averageSpeedRatio:
        aggregate
          .speedRatioTotal
        /
        aggregate
          .activeVehicles,
    })
  );
}

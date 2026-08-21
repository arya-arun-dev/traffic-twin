import type {
  RoadEdge,
  RoadGraph,
} from '../model/graph';

import type {
  Vehicle,
} from '../model/idm';

import {
  findRoute,
} from '../model/routing';

import type {
  EdgeOccupancy,
} from '../model/simulation';

import {
  stepSimulation,
} from '../model/simulation';

import {
  createGraphWithClosures,
} from './interventions';


const VEHICLE_LENGTH_METERS =
  4.5;

const MINIMUM_GAP_METERS =
  2;

const INITIAL_SPACING_METERS =
  VEHICLE_LENGTH_METERS
  + MINIMUM_GAP_METERS;


export type ScenarioMetrics = {
  activeVehicles: number;

  /*
   * Primary V1 outcome metric.
   *
   * Number of completed trips per simulated minute, measured over
   * at most the trailing 60 simulated seconds.
   */
  throughputPerMinute: number;

  completedTrips: number;
  simulationTimeSeconds: number;
};


type RunPair = {
  scenario:
    TrafficRun;

  baseline:
    TrafficRun
    | null;

  initialVehicleCount:
    number;
};


function createSeededRandom(
  seed: number
): () => number {

  let state =
    seed >>> 0;


  return () => {

    state +=
      0x6D2B79F5;

    let value =
      state;

    value =
      Math.imul(
        value
        ^ value >>> 15,
        value | 1
      );

    value ^=
      value
      +
      Math.imul(
        value
        ^ value >>> 7,
        value | 61
      );

    return (
      (
        value
        ^ value >>> 14
      )
      >>> 0
    )
    / 4294967296;
  };
}


function getOrCreateVehicles(
  occupancy: EdgeOccupancy,
  edge: RoadEdge
): Vehicle[] {

  let vehicles =
    occupancy.get(
      edge
    );

  if (!vehicles) {

    vehicles =
      [];

    occupancy.set(
      edge,
      vehicles
    );
  }

  return vehicles;
}


function edgeHasInitialCapacity(
  occupancy: EdgeOccupancy,
  edge: RoadEdge
): boolean {

  const capacity =
    Math.floor(
      edge.lengthMeters
      /
      INITIAL_SPACING_METERS
    );

  if (
    capacity <= 0
  ) {
    return false;
  }

  const occupied =
    occupancy.get(
      edge
    )?.length
    ?? 0;

  return (
    occupied
    <
    capacity
  );
}


function addVehicle(
  occupancy: EdgeOccupancy,
  route: RoadEdge[]
): void {

  const firstEdge =
    route[0];

  const vehicle:
    Vehicle = {
    route,
    routeIndex: 0,
    positionMeters: 0,
    speedMps: 0,
  };

  getOrCreateVehicles(
    occupancy,
    firstEdge
  )
    .push(
      vehicle
    );
}


function assignInitialPositions(
  occupancy: EdgeOccupancy
): void {

  /*
   * Matches the ordering invariant expected by simulation.ts:
   * rear-most -> front-most.
   */
  for (
    const vehicles
    of occupancy.values()
  ) {

    let positionMeters =
      VEHICLE_LENGTH_METERS;

    for (
      const vehicle
      of vehicles
    ) {

      vehicle.positionMeters =
        positionMeters;

      positionMeters +=
        INITIAL_SPACING_METERS;
    }
  }
}


/*
 * Builds deterministic initial state.
 *
 * In comparison mode, the scenario and baseline use the exact same
 * accepted origin/destination pairs. Their routes may differ because
 * the scenario topology may contain a closure.
 *
 * This is intentionally outside simulation.ts. The traffic timestep
 * remains independent of demand-generation policy.
 */
function createRunPair(
  scenarioGraph: RoadGraph,
  baselineGraph:
    RoadGraph
    | null,
  requestedVehicleCount: number,
  seed: number
): RunPair {

  const random =
    createSeededRandom(
      seed
    );

  const nodeIds =
    Array.from(
      scenarioGraph
        .nodes
        .keys()
    );

  const scenarioOccupancy:
    EdgeOccupancy =
    new Map();

  const baselineOccupancy:
    EdgeOccupancy
    | null =
    baselineGraph
    ? new Map()
    : null;

  let created =
    0;

  let attempts =
    0;

  const maxAttempts =
    Math.max(
      20_000,
      requestedVehicleCount
      * 250
    );


  while (
    created
    <
    requestedVehicleCount
    &&
    attempts
    <
    maxAttempts
  ) {

    attempts++;

    const originNodeId =
      nodeIds[
        Math.floor(
          random()
          *
          nodeIds.length
        )
      ];

    const destinationNodeId =
      nodeIds[
        Math.floor(
          random()
          *
          nodeIds.length
        )
      ];


    if (
      originNodeId
      === destinationNodeId
    ) {
      continue;
    }


    const scenarioRoute =
      findRoute(
        scenarioGraph,
        originNodeId,
        destinationNodeId
      );


    if (
      scenarioRoute.length === 0
    ) {
      continue;
    }


    if (
      !edgeHasInitialCapacity(
        scenarioOccupancy,
        scenarioRoute[0]
      )
    ) {
      continue;
    }


    let baselineRoute:
      RoadEdge[]
      | null =
      null;


    if (
      baselineGraph
      &&
      baselineOccupancy
    ) {

      baselineRoute =
        findRoute(
          baselineGraph,
          originNodeId,
          destinationNodeId
        );


      /*
       * Pairing rule:
       *
       * A comparison vehicle is accepted only if the same OD pair
       * can be represented in both runs.
       */
      if (
        baselineRoute.length === 0
      ) {
        continue;
      }


      if (
        !edgeHasInitialCapacity(
          baselineOccupancy,
          baselineRoute[0]
        )
      ) {
        continue;
      }
    }


    addVehicle(
      scenarioOccupancy,
      scenarioRoute
    );


    if (
      baselineOccupancy
      &&
      baselineRoute
    ) {

      addVehicle(
        baselineOccupancy,
        baselineRoute
      );
    }


    created++;
  }


  assignInitialPositions(
    scenarioOccupancy
  );


  if (
    baselineOccupancy
  ) {

    assignInitialPositions(
      baselineOccupancy
    );
  }


  return {
    scenario:
      new TrafficRun(
        scenarioGraph,
        scenarioOccupancy
      ),

    baseline:
      (
        baselineGraph
        &&
        baselineOccupancy
      )
      ? new TrafficRun(
          baselineGraph,
          baselineOccupancy
        )
      : null,

    initialVehicleCount:
      created,
  };
}


class TrafficRun {

  private readonly graph:
    RoadGraph;

  private readonly occupancy:
    EdgeOccupancy;

  private completedTrips =
    0;

  private completionTimes:
    number[] =
    [];

  private simulationTimeSeconds =
    0;


  constructor(
    graph: RoadGraph,
    occupancy: EdgeOccupancy
  ) {

    this.graph =
      graph;

    this.occupancy =
      occupancy;
  }


  step(
    deltaSeconds: number
  ): void {

    const completed =
      stepSimulation(
        this.occupancy,
        deltaSeconds
      );

    this.simulationTimeSeconds +=
      deltaSeconds;


    if (
      completed > 0
    ) {

      this.completedTrips +=
        completed;

      for (
        let i = 0;
        i < completed;
        i++
      ) {

        this.completionTimes.push(
          this.simulationTimeSeconds
        );
      }
    }


    const cutoff =
      this.simulationTimeSeconds
      - 60;

    this.completionTimes =
      this.completionTimes.filter(
        completionTime =>
          completionTime
          >= cutoff
      );
  }


  getGraph():
    RoadGraph {

    return this.graph;
  }


  getOccupancy():
    EdgeOccupancy {

    return this.occupancy;
  }


  getMetrics():
    ScenarioMetrics {

    let activeVehicles =
      0;


    for (
      const vehicles
      of this.occupancy.values()
    ) {

      activeVehicles +=
        vehicles.length;
    }


    const measurementWindowSeconds =
      Math.min(
        60,
        this.simulationTimeSeconds
      );

    const throughputPerMinute =
      measurementWindowSeconds <= 0
      ? 0
      : (
          this.completionTimes.length
          /
          measurementWindowSeconds
        )
        * 60;


    return {
      activeVehicles,

      throughputPerMinute,

      completedTrips:
        this.completedTrips,

      simulationTimeSeconds:
        this.simulationTimeSeconds,
    };
  }


  isComplete():
    boolean {

    for (
      const vehicles
      of this.occupancy.values()
    ) {

      if (
        vehicles.length > 0
      ) {
        return false;
      }
    }

    return true;
  }
}


export class ScenarioExperiment {

  private readonly scenario:
    TrafficRun;

  private readonly baseline:
    TrafficRun
    | null;

  readonly initialVehicleCount:
    number;


  constructor(
    baseGraph: RoadGraph,
    closedSegmentKeys:
      ReadonlySet<string>,
    requestedVehicleCount:
      number,
    seed: number,
    comparisonEnabled:
      boolean
  ) {

    const scenarioGraph =
      createGraphWithClosures(
        baseGraph,
        closedSegmentKeys
      );

    const pair =
      createRunPair(
        scenarioGraph,

        comparisonEnabled
        ? baseGraph
        : null,

        requestedVehicleCount,

        seed
      );

    this.scenario =
      pair.scenario;

    this.baseline =
      pair.baseline;

    this.initialVehicleCount =
      pair.initialVehicleCount;
  }


  step(
    deltaSeconds: number
  ): void {

    this.scenario.step(
      deltaSeconds
    );

    this.baseline?.step(
      deltaSeconds
    );
  }


  getScenarioGraph():
    RoadGraph {

    return this.scenario
      .getGraph();
  }


  getScenarioOccupancy():
    EdgeOccupancy {

    return this.scenario
      .getOccupancy();
  }


  getScenarioMetrics():
    ScenarioMetrics {

    return this.scenario
      .getMetrics();
  }


  getBaselineMetrics():
    ScenarioMetrics
    | null {

    return this.baseline
      ?.getMetrics()
      ?? null;
  }


  isComplete():
    boolean {

    if (
      !this.scenario
        .isComplete()
    ) {
      return false;
    }

    if (
      this.baseline
      &&
      !this.baseline
        .isComplete()
    ) {
      return false;
    }

    return true;
  }
}

import {
  ScenarioExperiment,
} from '../../../src/scenario/ScenarioExperiment';

import {
  fromRoadGraphDto,
} from '../../../src/transport/roadGraphDto';

import type {
  SimulationRequest,
  SimulationResponse,
} from './types';


export const FIXED_STEP_SECONDS =
  0.05;


function calculateThroughputDeltaPercent(
  scenarioThroughput: number,
  baselineThroughput: number | null
): number | null {

  if (
    baselineThroughput === null
    ||
    baselineThroughput <= 0
  ) {
    return null;
  }


  return (
    (
      scenarioThroughput
      - baselineThroughput
    )
    /
    baselineThroughput
  )
  * 100;
}


export function runHeadlessSimulation(
  request: SimulationRequest
): SimulationResponse {

  const graph =
    fromRoadGraphDto(
      request.network
    );

  const experiment =
    new ScenarioExperiment(
      graph,
      new Set(
        request.closedSegmentKeys
      ),
      request.requestedVehicleCount,
      request.seed,
      request.comparisonEnabled
    );

  const maxSteps =
    Math.ceil(
      request.maxSimulationSeconds
      /
      FIXED_STEP_SECONDS
    );


  for (
    let step = 0;
    step < maxSteps;
    step++
  ) {

    if (
      experiment.isComplete()
    ) {
      break;
    }


    experiment.step(
      FIXED_STEP_SECONDS
    );
  }


  const scenarioMetrics =
    experiment.getScenarioMetrics();

  const baselineMetrics =
    experiment.getBaselineMetrics();

  const complete =
    experiment.isComplete();


  return {
    initialVehicleCount:
      experiment.initialVehicleCount,
    scenarioMetrics,
    baselineMetrics,
    throughputDeltaPercent:
      calculateThroughputDeltaPercent(
        scenarioMetrics.throughputPerMinute,
        baselineMetrics
          ?.throughputPerMinute
        ?? null
      ),
    simulationDurationSeconds:
      Math.max(
        scenarioMetrics.simulationTimeSeconds,
        baselineMetrics
          ?.simulationTimeSeconds
        ?? 0
      ),
    completedTrips:
      scenarioMetrics.completedTrips,
    completionReason:
      complete
      ? 'ALL_TRIPS_COMPLETED'
      : 'MAX_SIMULATION_TIME_REACHED',
  };
}

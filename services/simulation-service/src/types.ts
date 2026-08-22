import type {
  ScenarioMetrics,
} from '../../../src/scenario/ScenarioExperiment';

import type {
  RoadGraphDto,
} from '../../../src/transport/roadGraphDto';


export type SimulationRequest = {
  network: RoadGraphDto;
  closedSegmentKeys: string[];
  requestedVehicleCount: number;
  seed: number;
  comparisonEnabled: boolean;
  maxSimulationSeconds: number;
};


export type CompletionReason =
  | 'ALL_TRIPS_COMPLETED'
  | 'MAX_SIMULATION_TIME_REACHED';


export type SimulationResponse = {
  initialVehicleCount: number;
  scenarioMetrics: ScenarioMetrics;
  baselineMetrics: ScenarioMetrics | null;
  throughputDeltaPercent: number | null;
  simulationDurationSeconds: number;
  completedTrips: number;
  completionReason: CompletionReason;
};

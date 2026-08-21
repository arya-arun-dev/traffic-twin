import type {
  RoadGraph,
} from '../model/graph';

import type {
  ScenarioMetrics,
} from '../scenario/ScenarioExperiment';

import type {
  RoadSpeedView,
  VehicleView,
} from '../application/viewModels';


export type InitializeSimulationCommand = {
  type: 'INITIALIZE';
  experimentId: number;
  graph: RoadGraph;
  closedSegmentKeys: string[];
  requestedVehicleCount: number;
  seed: number;
  comparisonEnabled: boolean;
  running: boolean;
};


export type ResetSimulationCommand = {
  type: 'RESET';
  experimentId: number;
  closedSegmentKeys: string[];
  requestedVehicleCount: number;
  seed: number;
  comparisonEnabled: boolean;
  running: boolean;
};


export type SetSimulationRunningCommand = {
  type: 'SET_RUNNING';
  experimentId: number;
  running: boolean;
};


export type SimulationWorkerCommand =
  | InitializeSimulationCommand
  | ResetSimulationCommand
  | SetSimulationRunningCommand;


export type SimulationStateMessage = {
  type: 'STATE';
  experimentId: number;
  initialVehicleCount: number;
  vehicles: VehicleView[];
  scenarioMetrics: ScenarioMetrics;
  baselineMetrics: ScenarioMetrics | null;
};


export type RoadSpeedsMessage = {
  type: 'ROAD_SPEEDS';
  experimentId: number;
  roadSpeeds: RoadSpeedView[];
};


export type SimulationCompleteMessage = {
  type: 'COMPLETE';
  experimentId: number;
};


export type SimulationErrorMessage = {
  type: 'ERROR';
  experimentId: number | null;
  message: string;
};


export type SimulationWorkerResponse =
  | SimulationStateMessage
  | RoadSpeedsMessage
  | SimulationCompleteMessage
  | SimulationErrorMessage;

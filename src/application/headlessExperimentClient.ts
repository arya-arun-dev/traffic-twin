import type {
  ScenarioMetrics,
} from '../scenario/ScenarioExperiment';

import type {
  RoadGraphDto,
} from '../transport/roadGraphDto';


export type HeadlessExperimentStatus =
  | 'RUNNING'
  | 'COMPLETED'
  | 'FAILED';


export type HeadlessCompletionReason =
  | 'ALL_TRIPS_COMPLETED'
  | 'MAX_SIMULATION_TIME_REACHED';


export type HeadlessExperimentRequest = {
  network: RoadGraphDto;
  closedSegmentKeys: string[];
  requestedVehicleCount: number;
  seed: number;
  comparisonEnabled: boolean;
  maxSimulationSeconds?: number;
};


export type HeadlessExperimentResponse = {
  id: string;
  createdAt: string;
  completedAt: string | null;
  status: HeadlessExperimentStatus;
  requestedVehicleCount: number;
  initialVehicleCount: number | null;
  seed: number;
  comparisonEnabled: boolean;
  closedSegmentKeys: string[];
  scenarioMetrics: ScenarioMetrics | null;
  baselineMetrics: ScenarioMetrics | null;
  throughputDeltaPercent: number | null;
  simulationDurationSeconds: number | null;
  completedTrips: number | null;
  completionReason: HeadlessCompletionReason | null;
  failureMessage: string | null;
};


const API_BASE_URL =
  (
    import.meta.env
      .VITE_API_BASE_URL
    ?? 'http://localhost:8080'
  )
    .replace(
      /\/$/,
      ''
    );


export async function runHeadlessExperiment(
  request: HeadlessExperimentRequest
): Promise<HeadlessExperimentResponse> {

  const response =
    await fetch(
      `${API_BASE_URL}/api/experiments`,
      {
        method: 'POST',
        headers: {
          'Content-Type':
            'application/json',
        },
        body:
          JSON.stringify(
            request
          ),
      }
    );


  if (!response.ok) {

    let message =
      `Experiment request failed with HTTP ${response.status}.`;


    try {

      const errorBody:
        unknown =
        await response.json();


      if (
        typeof errorBody === 'object'
        &&
        errorBody !== null
        &&
        'detail' in errorBody
        &&
        typeof errorBody.detail === 'string'
      ) {

        message =
          errorBody.detail;
      }

    } catch {
      // Preserve the HTTP status fallback when the response is not JSON.
    }


    throw new Error(
      message
    );
  }


  return response.json();
}

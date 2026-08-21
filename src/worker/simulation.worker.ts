import {
  buildRoadSpeedViews,
  buildVehicleViews,
  VehicleIdentityRegistry,
} from '../application/viewModels';

import type {
  RoadGraph,
} from '../model/graph';

import {
  ScenarioExperiment,
} from '../scenario/ScenarioExperiment';

import type {
  InitializeSimulationCommand,
  ResetSimulationCommand,
  SimulationWorkerCommand,
  SimulationWorkerResponse,
} from './simulationProtocol.ts';


/*
 * Fixed model timestep.
 *
 * Moving scheduling into a worker must not change the numerical
 * experiment. ScenarioExperiment continues to receive exactly 0.05 s
 * on every model step.
 */
const FIXED_STEP_SECONDS =
  0.05;

const SNAPSHOT_INTERVAL_MS =
  66;

const ROAD_TELEMETRY_INTERVAL_MS =
  250;

const MAX_CATCH_UP_STEPS =
  5;

/*
 * This interval only determines how often the worker checks elapsed
 * wall-clock time. Physics time is still advanced exclusively through
 * the fixed-step accumulator above.
 */
const SCHEDULER_INTERVAL_MS =
  16;


type SimulationWorkerScope = {
  postMessage: (
    message: SimulationWorkerResponse
  ) => void;

  onmessage:
    | ((
        event: MessageEvent<SimulationWorkerCommand>
      ) => void)
    | null;
};


const workerScope =
  globalThis as unknown as SimulationWorkerScope;


let baseGraph:
  RoadGraph
  | null =
  null;

let experiment:
  ScenarioExperiment
  | null =
  null;

let identityRegistry =
  new VehicleIdentityRegistry();

let currentExperimentId =
  0;

let running =
  false;

let completionSent =
  false;

let previousTime =
  performance.now();

let accumulatorSeconds =
  0;

let lastSnapshotTime =
  previousTime;

let lastTelemetryTime =
  previousTime;


function postResponse(
  message: SimulationWorkerResponse
): void {

  workerScope.postMessage(
    message
  );
}


function publishState(): void {

  if (!experiment) {
    return;
  }


  postResponse({
    type: 'STATE',
    experimentId:
      currentExperimentId,
    initialVehicleCount:
      experiment.initialVehicleCount,
    vehicles:
      buildVehicleViews(
        experiment.getScenarioGraph(),
        experiment.getScenarioOccupancy(),
        identityRegistry
      ),
    scenarioMetrics:
      experiment.getScenarioMetrics(),
    baselineMetrics:
      experiment.getBaselineMetrics(),
  });
}


function publishRoadSpeeds(): void {

  if (!experiment) {
    return;
  }


  postResponse({
    type: 'ROAD_SPEEDS',
    experimentId:
      currentExperimentId,
    roadSpeeds:
      buildRoadSpeedViews(
        experiment.getScenarioOccupancy()
      ),
  });
}


function publishCompletion(): void {

  if (
    !experiment
    || completionSent
    || !experiment.isComplete()
  ) {
    return;
  }


  completionSent =
    true;

  running =
    false;


  /*
   * Publish the terminal projections immediately so React does not
   * wait for the next snapshot/telemetry interval after completion.
   */
  publishState();
  publishRoadSpeeds();


  postResponse({
    type: 'COMPLETE',
    experimentId:
      currentExperimentId,
  });
}


function startExperiment(
  graph: RoadGraph,
  command:
    InitializeSimulationCommand
    | ResetSimulationCommand
): void {

  currentExperimentId =
    command.experimentId;

  experiment =
    new ScenarioExperiment(
      graph,
      new Set(
        command.closedSegmentKeys
      ),
      command.requestedVehicleCount,
      command.seed,
      command.comparisonEnabled
    );

  identityRegistry =
    new VehicleIdentityRegistry();

  running =
    command.running;

  completionSent =
    false;

  accumulatorSeconds =
    0;


  const now =
    performance.now();

  previousTime =
    now;

  lastSnapshotTime =
    now;

  lastTelemetryTime =
    now;


  /*
   * Match the previous main-thread initialization behavior: publish
   * the time-zero vehicle/metric and road-speed projections before
   * the first model step executes.
   */
  publishState();
  publishRoadSpeeds();

  publishCompletion();
}


function initializeExperiment(
  command: InitializeSimulationCommand
): void {

  const graph =
    command.graph;

  baseGraph =
    graph;

  startExperiment(
    graph,
    command
  );
}


function resetExperiment(
  command: ResetSimulationCommand
): void {

  if (!baseGraph) {
    throw new Error(
      'Simulation worker has not been initialized with a road graph.'
    );
  }


  startExperiment(
    baseGraph,
    command
  );
}


function schedulerTick(): void {

  const now =
    performance.now();

  const elapsedSeconds =
    Math.min(
      0.25,
      Math.max(
        0,
        (
          now
          - previousTime
        )
        / 1000
      )
    );


  previousTime =
    now;


  if (
    running
    && experiment
  ) {

    accumulatorSeconds +=
      elapsedSeconds;


    let catchUpSteps =
      0;


    while (
      accumulatorSeconds
      >= FIXED_STEP_SECONDS
      &&
      catchUpSteps
      < MAX_CATCH_UP_STEPS
    ) {

      experiment.step(
        FIXED_STEP_SECONDS
      );

      accumulatorSeconds -=
        FIXED_STEP_SECONDS;

      catchUpSteps++;
    }


    /*
     * Preserve the previous runtime protection exactly: after the
     * configured catch-up ceiling, discard an unbounded backlog.
     */
    if (
      catchUpSteps
      === MAX_CATCH_UP_STEPS
      &&
      accumulatorSeconds
      >= FIXED_STEP_SECONDS
    ) {

      accumulatorSeconds =
        0;
    }


    publishCompletion();
  }


  if (
    experiment
    &&
    now
    - lastSnapshotTime
    >= SNAPSHOT_INTERVAL_MS
  ) {

    publishState();

    lastSnapshotTime =
      now;
  }


  if (
    experiment
    &&
    now
    - lastTelemetryTime
    >= ROAD_TELEMETRY_INTERVAL_MS
  ) {

    publishRoadSpeeds();

    lastTelemetryTime =
      now;
  }


  setTimeout(
    schedulerTick,
    SCHEDULER_INTERVAL_MS
  );
}


workerScope.onmessage =
  event => {

    const command =
      event.data;


    try {

      switch (
        command.type
      ) {

        case 'INITIALIZE':

          initializeExperiment(
            command
          );

          return;


        case 'RESET':

          resetExperiment(
            command
          );

          return;


        case 'SET_RUNNING':

          if (
            command.experimentId
            !== currentExperimentId
          ) {
            return;
          }

          running =
            command.running;

          return;
      }

    } catch (error) {

      running =
        false;


      postResponse({
        type: 'ERROR',
        experimentId:
          command.experimentId
          ?? null,
        message:
          error instanceof Error
          ? error.message
          : 'Simulation worker failed.',
      });
    }
  };


setTimeout(
  schedulerTick,
  SCHEDULER_INTERVAL_MS
);

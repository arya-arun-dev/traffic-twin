import assert
  from 'node:assert/strict';

import test
  from 'node:test';

import type {
  RoadGraphDto,
} from '../../../src/transport/roadGraphDto';

import {
  runHeadlessSimulation,
} from '../src/runner';


const network:
  RoadGraphDto = {
  nodes: [
    {
      id: 1,
      latitude: 30.0,
      longitude: -97.0,
    },
    {
      id: 2,
      latitude: 30.0,
      longitude: -96.999,
    },
    {
      id: 3,
      latitude: 30.0,
      longitude: -96.998,
    },
  ],
  edges: [
    {
      from: 1,
      to: 2,
      lengthMeters: 100,
      speedLimitMps: 15,
    },
    {
      from: 2,
      to: 3,
      lengthMeters: 100,
      speedLimitMps: 15,
    },
    {
      from: 2,
      to: 1,
      lengthMeters: 100,
      speedLimitMps: 15,
    },
    {
      from: 3,
      to: 2,
      lengthMeters: 100,
      speedLimitMps: 15,
    },
  ],
};


test(
  'headless runner is deterministic for the same request',
  () => {

    const request = {
      network,
      closedSegmentKeys: [],
      requestedVehicleCount: 4,
      seed: 12345,
      comparisonEnabled: true,
      maxSimulationSeconds: 120,
    };

    const first =
      runHeadlessSimulation(
        request
      );

    const second =
      runHeadlessSimulation(
        request
      );


    assert.deepEqual(
      first,
      second
    );

    assert.equal(
      first.initialVehicleCount,
      4
    );

    assert.ok(
      first.baselineMetrics
    );
  }
);


test(
  'headless runner stops at the configured simulated-duration limit',
  () => {

    const result =
      runHeadlessSimulation({
        network,
        closedSegmentKeys: [],
        requestedVehicleCount: 4,
        seed: 12345,
        comparisonEnabled: false,
        maxSimulationSeconds: 0.05,
      });


    assert.equal(
      result.completionReason,
      'MAX_SIMULATION_TIME_REACHED'
    );

    assert.equal(
      result.scenarioMetrics.simulationTimeSeconds,
      0.05
    );
  }
);

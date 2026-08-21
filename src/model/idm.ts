import type {
  RoadEdge,
} from './graph';

export type Vehicle = {
  route: RoadEdge[];
  routeIndex: number;
  positionMeters: number;
  speedMps: number;
};

export type CandidateVehicleStepResult = {
  travelMeters: number;
  nextSpeedMps: number;
};

// IDM parameters
const TIME_HEADWAY_SECONDS = 1.5;
const MINIMUM_GAP_METERS = 2;
const MAX_ACCELERATION_MPS2 = 1.0;
const COMFORTABLE_BRAKING_MPS2 = 2.0;
const ACCELERATION_EXPONENT = 4;


function calculateAcceleration(
  speedMps: number,
  leaderSpeedMps: number,
  gapMeters: number,
  desiredSpeedMps: number
): number {

  const deltaSpeed =
    speedMps - leaderSpeedMps;

    const desiredGap =
    MINIMUM_GAP_METERS
    +
    Math.max(
        0,
        speedMps * TIME_HEADWAY_SECONDS
        +
        (
        speedMps * deltaSpeed
        /
        (
            2
            * Math.sqrt(
            MAX_ACCELERATION_MPS2
            * COMFORTABLE_BRAKING_MPS2
            )
        )
        )
    );

  return (
    MAX_ACCELERATION_MPS2
    *
    (
      1
      -
      Math.pow(
        speedMps / desiredSpeedMps,
        ACCELERATION_EXPONENT
      )
      -
      Math.pow(
        desiredGap / gapMeters,
        2
      )
    )
  );
}

// Calculates the vehicle's proposed motion
// for one timestep without mutating the vehicle.
export function calculateCandidateVehicleStep(
  vehicle: Vehicle,
  leaderSpeedMps: number,
  gapMeters: number,
  deltaSeconds: number
): CandidateVehicleStepResult {

  const currentEdge =
    vehicle.route[
      vehicle.routeIndex
    ];


  const accelerationMps2 =
    calculateAcceleration(
      vehicle.speedMps,
      leaderSpeedMps,
      gapMeters,
      currentEdge.speedLimitMps
    );


  const nextSpeedMps =
    vehicle.speedMps
    + accelerationMps2
    * deltaSeconds;


  /*
   * If the vehicle would reach zero speed
   * before the end of this timestep,
   * calculate the distance traveled before
   * stopping.
   *
   * vf² = vi² + 2aΔx
   *
   * At the stopping point:
   *
   * vf = 0
   *
   * Therefore:
   *
   * Δx = -vi² / (2a)
   */
  if (
    nextSpeedMps < 0
  ) {

    const stoppingDistance =
      -(
        vehicle.speedMps
        * vehicle.speedMps
      )
      /
      (
        2
        * accelerationMps2
      );


    return {
      travelMeters:
        stoppingDistance,

      nextSpeedMps:
        0,
    };
  }


  /*
   * Ballistic integration:
   *
   * Δx =
   * v*dt + 1/2*a*dt²
   */
  const travelMeters =
    vehicle.speedMps
    * deltaSeconds
    +
    0.5
    * accelerationMps2
    * deltaSeconds
    * deltaSeconds;


  return {
    travelMeters,
    nextSpeedMps,
  };
}
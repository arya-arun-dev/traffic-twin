import type {
  RoadEdge,
  RoadGraph,
} from './graph';

import {
  findRoute,
} from './routing';

import type {
  Vehicle,
} from './idm';

import {
  calculateCandidateVehicleStep,
} from './idm';

// Current state of simulation
export type EdgeOccupancy =
  Map<RoadEdge, Vehicle[]>;

// Candidate states
type EdgeUpdates =
  Map<RoadEdge, VehicleUpdate[]>; 

type VehicleUpdate = {
  vehicle: Vehicle;
  travelMeters: number;
  nextSpeedMps: number;
};

// Junction Types
type JunctionRequests =
  Map<
    RoadEdge['to'],
    Map<
      RoadEdge,
      Map<
        RoadEdge,
        VehicleUpdate[]
      >
    >
  >;

type JunctionMovement = {
  incomingEdge: RoadEdge;
  outgoingEdge: RoadEdge;
};

type JunctionPermissions =
  Map<
    RoadEdge['to'],
    JunctionMovement[]
  >;


const VEHICLE_LENGTH_METERS = 4.5;
const MINIMUM_GAP_METERS = 2;

const INITIAL_SPACING_METERS =
  VEHICLE_LENGTH_METERS
  + MINIMUM_GAP_METERS;

const MAX_LEADER_LOOKAHEAD_METERS = 200;


// Creates random vehicles and places them in the graph.
export function createInitialOccupancy(
  graph: RoadGraph,
  vehicleCount: number
): EdgeOccupancy {

  const occupancy: EdgeOccupancy =
    new Map();

  const nodeIds =
    Array.from(
      graph.nodes.keys()
    );

  let createdVehicles = 0;


  while (
    createdVehicles < vehicleCount
  ) {

    const originNodeId =
      nodeIds[
        Math.floor(
          Math.random()
          * nodeIds.length
        )
      ];

    const destinationNodeId =
      nodeIds[
        Math.floor(
          Math.random()
          * nodeIds.length
        )
      ];


    if (
      originNodeId
      === destinationNodeId
    ) {
      continue;
    }


    const route =
      findRoute(
        graph,
        originNodeId,
        destinationNodeId
      );


    if (
      route.length === 0
    ) {
      continue;
    }


    const firstEdge =
      route[0];


    let edgeVehicles =
      occupancy.get(
        firstEdge
      );


    if (!edgeVehicles) {

      edgeVehicles = [];

      occupancy.set(
        firstEdge,
        edgeVehicles
      );
    }


    /*
     * Each initially placed vehicle consumes:
     *
     * vehicle length + minimum gap
     */
    const capacity =
      Math.floor(
        firstEdge.lengthMeters
        /
        INITIAL_SPACING_METERS
      );


    if (
      edgeVehicles.length
      >= capacity
    ) {
      continue;
    }


    const vehicle: Vehicle = {
      route,
      routeIndex: 0,
      positionMeters: 0,
      speedMps: 0,
    };


    edgeVehicles.push(
      vehicle
    );

    createdVehicles++;
  }


  /*
   * Vehicles are already in insertion order.
   *
   * Place the first vehicle one vehicle-length
   * into the edge. Each following vehicle is
   * another vehicle length + minimum gap ahead.
   *
   * This also establishes the occupancy arrays
   * in increasing position order.
   */
  for (
    const edgeVehicles
    of occupancy.values()
  ) {

    let positionMeters =
      VEHICLE_LENGTH_METERS;


    for (
      const vehicle
      of edgeVehicles
    ) {

      vehicle.positionMeters =
        positionMeters;

      positionMeters +=
        INITIAL_SPACING_METERS;
    }
  }


  return occupancy;
}


function getLeaderInfo(
  vehicle: Vehicle,
  edgeVehicles: Vehicle[],
  vehicleIndex: number,
  occupancy: EdgeOccupancy
): {
  leaderSpeedMps: number;
  gapMeters: number;
} {

  /*
   * Case 1:
   * There is another vehicle ahead
   * on the same edge.
   *
   * The occupancy array is maintained
   * in increasing position order, so
   * the next element is the leader.
   */
  if (
    vehicleIndex
    < edgeVehicles.length - 1
  ) {

    const leader =
      edgeVehicles[
        vehicleIndex + 1
      ];

    return {
      leaderSpeedMps:
        leader.speedMps,

      gapMeters:
        leader.positionMeters
        - vehicle.positionMeters
        - VEHICLE_LENGTH_METERS,
    };
  }


  /*
   * Case 2:
   * This vehicle is the front-most
   * vehicle on its current edge.
   *
   * Search forward through its route
   * for a downstream leader, but only
   * up to MAX_LEADER_LOOKAHEAD_METERS.
   */


  /*
   * Distance from the vehicle's current
   * position to the beginning of the
   * next route edge.
   */
  let gapMeters =
    vehicle.route[
      vehicle.routeIndex
    ].lengthMeters
    - vehicle.positionMeters;


  /*
   * If even the next edge starts beyond
   * the lookahead distance, no downstream
   * vehicle can matter to IDM.
   */
  if (
    gapMeters
    > MAX_LEADER_LOOKAHEAD_METERS
  ) {

    return {
      leaderSpeedMps:
        vehicle.speedMps,

      gapMeters:
        Infinity,
    };
  }


  /*
   * Search subsequent route edges.
   */
  for (
    let routeIndex =
      vehicle.routeIndex + 1;

    routeIndex
      < vehicle.route.length;

    routeIndex++
  ) {

    const edge =
      vehicle.route[
        routeIndex
      ];

    const vehiclesOnEdge =
      occupancy.get(
        edge
      );


    /*
     * A vehicle exists on this
     * downstream edge.
     */
    if (
      vehiclesOnEdge
      &&
      vehiclesOnEdge.length > 0
    ) {

      /*
       * Arrays are ordered from lowest
       * position to highest position.
       *
       * Therefore vehiclesOnEdge[0]
       * is the vehicle closest to the
       * beginning of this edge.
       */
      const leader =
        vehiclesOnEdge[0];


      /*
       * Exact bumper-to-bumper distance
       * from our vehicle to this leader.
       */
      const leaderGapMeters =
        gapMeters
        + leader.positionMeters
        - VEHICLE_LENGTH_METERS;


      /*
       * The edge itself begins inside
       * our lookahead range, but the
       * leader may still be farther than
       * MAX_LEADER_LOOKAHEAD_METERS.
       */
      if (
        leaderGapMeters
        > MAX_LEADER_LOOKAHEAD_METERS
      ) {

        return {
          leaderSpeedMps:
            vehicle.speedMps,

          gapMeters:
            Infinity,
        };
      }


      /*
       * This is the nearest downstream
       * vehicle and it is within the
       * lookahead distance.
       */
      return {
        leaderSpeedMps:
          leader.speedMps,

        gapMeters:
          leaderGapMeters,
      };
    }


    /*
     * No vehicle exists on this edge.
     *
     * Add the entire edge length so
     * gapMeters now represents the
     * distance to the beginning of
     * the following route edge.
     */
    gapMeters +=
      edge.lengthMeters;


    /*
     * We have now traveled farther than
     * the maximum leader lookahead.
     *
     * Every remaining edge and vehicle
     * must be even farther away, so stop.
     */
    if (
      gapMeters
      > MAX_LEADER_LOOKAHEAD_METERS
    ) {

      return {
        leaderSpeedMps:
          vehicle.speedMps,

        gapMeters:
          Infinity,
      };
    }
  }


  /*
   * The route ended before the lookahead
   * distance was exhausted, and no leader
   * was found.
   *
   */
  return {
    leaderSpeedMps:
      vehicle.speedMps,

    gapMeters:
      Infinity,
  };
}


function calculateVehicleUpdates(
  occupancy: EdgeOccupancy,
  deltaSeconds: number
): EdgeUpdates {

  const updates: EdgeUpdates =
    new Map();


  for (
    const [
      edge,
      edgeVehicles,
    ]
    of occupancy
  ) {

    const edgeUpdates:
      VehicleUpdate[] =
      [];


    for (
      let i = 0;
      i < edgeVehicles.length;
      i++
    ) {

      const vehicle =
        edgeVehicles[i];


      /*
       * Read the leader from the actual
       * simulation state at time t.
       */
      const leaderInfo =
        getLeaderInfo(
          vehicle,
          edgeVehicles,
          i,
          occupancy
        );


      /*
       * Calculate the candidate movement
       * for this timestep.
       *
       * calculateCandidateVehicleStep()
       * does not mutate the vehicle.
       */
      const candidate =
        calculateCandidateVehicleStep(
          vehicle,
          leaderInfo.leaderSpeedMps,
          leaderInfo.gapMeters,
          deltaSeconds
        );


      edgeUpdates.push({
        vehicle,

        travelMeters:
          candidate.travelMeters,

        nextSpeedMps:
          candidate.nextSpeedMps,
      });
    }


    updates.set(
      edge,
      edgeUpdates
    );
  }


  return updates;
}


function enforceSameEdgeSpacing(
  updates: EdgeUpdates,
  edges?: Iterable<RoadEdge>
): void {

  const edgesToCheck =
    edges
    ?? updates.keys();


  for (
    const edge
    of edgesToCheck
  ) {

    const edgeUpdates =
      updates.get(
        edge
      )!;


    /*
     * rear-most -> front-most
     *
     * Work backward so the leader has
     * already been resolved before the
     * follower is checked.
     */
    for (
      let i =
        edgeUpdates.length - 2;

      i >= 0;

      i--
    ) {

      const followerUpdate =
        edgeUpdates[i];

      const leaderUpdate =
        edgeUpdates[i + 1];

      const follower =
        followerUpdate.vehicle;

      const leader =
        leaderUpdate.vehicle;


      const followerCandidatePosition =
        follower.positionMeters
        + followerUpdate.travelMeters;

      const leaderCandidatePosition =
        leader.positionMeters
        + leaderUpdate.travelMeters;


      const maximumFollowerPosition =
        leaderCandidatePosition
        - INITIAL_SPACING_METERS;


      if (
        followerCandidatePosition
        >
        maximumFollowerPosition
      ) {

        followerUpdate.travelMeters =
          maximumFollowerPosition
          - follower.positionMeters;

        followerUpdate.nextSpeedMps =
          Math.min(
            followerUpdate.nextSpeedMps,
            leaderUpdate.nextSpeedMps
          );
      }
    }
  }
}

// Junction
//   → Incoming Edge
//       → Outgoing Edge
//           → Vehicle Updates

function buildJunctionRequests( 
  updates: EdgeUpdates
): JunctionRequests {

  const junctionRequests:
    JunctionRequests =
    new Map();


  for (
    const [
      incomingEdge,
      edgeUpdates,
    ]
    of updates
  ) {

    /*
     * Updates are ordered:
     *
     * rear-most -> front-most
     *
     * Start at the front because only
     * vehicles whose candidate positions
     * cross the edge boundary need to
     * make junction requests.
     */
    for (
      let i =
        edgeUpdates.length - 1;

      i >= 0;

      i--
    ) {

      const update =
        edgeUpdates[i];

      const vehicle =
        update.vehicle;


      const candidatePosition =
        vehicle.positionMeters
        + update.travelMeters;


      /*
       * This vehicle does not cross the
       * current edge boundary.
       *
       * Because ordering has already been
       * corrected, no vehicle behind it
       * can have crossed either.
       */
      if (
        candidatePosition
        <= incomingEdge.lengthMeters
      ) {
        break;
      }


      const nextRouteIndex =
        vehicle.routeIndex + 1;


      /*
       * No next edge means the vehicle
       * is reaching its destination.
       *
       * That is not a junction request.
       */
      if (
        nextRouteIndex
        >= vehicle.route.length
      ) {
        continue;
      }


      const outgoingEdge =
        vehicle.route[
          nextRouteIndex
        ];


      const junctionId =
        incomingEdge.to;


      /*
       * Get or create:
       *
       * junction
       */
      let junction =
        junctionRequests.get(
          junctionId
        );

      if (!junction) {

        junction =
          new Map();

        junctionRequests.set(
          junctionId,
          junction
        );
      }


      /*
       * Get or create:
       *
       * incoming edge
       */
      let outgoingMovements =
        junction.get(
          incomingEdge
        );

      if (!outgoingMovements) {

        outgoingMovements =
          new Map();

        junction.set(
          incomingEdge,
          outgoingMovements
        );
      }


      /*
       * Get or create:
       *
       * incoming edge -> outgoing edge
       * movement
       */
      let requestingVehicles =
        outgoingMovements.get(
          outgoingEdge
        );

      if (!requestingVehicles) {

        requestingVehicles =
          [];

        outgoingMovements.set(
          outgoingEdge,
          requestingVehicles
        );
      }


      requestingVehicles.push(
        update
      );
    }
  }


  return junctionRequests;
}

// Returns JunctionPermissions
// Note: JunctionMovement[] is currently array even though V1 permits only one movement
function resolveJunctionRequests(
  junctionRequests: JunctionRequests
): JunctionPermissions {

  const permissions:
    JunctionPermissions =
    new Map();


  for (
    const [
      junctionId,
      incomingEdges,
    ]
    of junctionRequests
  ) {

    let selectedMovement:
      JunctionMovement
      | null =
      null;


    /*
     * V1:
     *
     * At each junction, choose one
     * incoming stream that currently
     * has a vehicle requesting entry.
     */
    for (
      const [
        incomingEdge,
        outgoingMovements,
      ]
      of incomingEdges
    ) {

      let frontMostOutgoingEdge:
        RoadEdge
        | null =
        null;

      let frontMostPosition =
        -Infinity;


      /*
       * One incoming edge may have
       * requests for multiple outgoing
       * edges.
       *
       * Determine which movement belongs
       * to the physically front-most
       * requesting vehicle.
       */
      for (
        const [
          outgoingEdge,
          movementUpdates,
        ]
        of outgoingMovements
      ) {


        /*
         * buildJunctionRequests() stored
         * movement requests front-most
         * first.
         */
        const frontUpdate =
          movementUpdates[0];


        const candidatePosition =
          frontUpdate.vehicle.positionMeters
          + frontUpdate.travelMeters;


        if (
          candidatePosition
          > frontMostPosition
        ) {

          frontMostPosition =
            candidatePosition;

          frontMostOutgoingEdge =
            outgoingEdge;
        }
      }


      /*
       * This incoming edge has at least
       * one executable head-of-queue
       * movement.
       */
      if (
        frontMostOutgoingEdge
      ) {

        selectedMovement = {
          incomingEdge,
          outgoingEdge:
            frontMostOutgoingEdge,
        };

        /*
         * V1 permits only one movement
         * at this junction.
         */
        break;
      }
    }


    if (
      selectedMovement
    ) {

      permissions.set(
        junctionId,
        [
          selectedMovement,
        ]
      );
    }
  }


  return permissions;
}

// Stops candidates whose movement was denied
function applyJunctionPermissions(
  junctionRequests: JunctionRequests,
  junctionPermissions: JunctionPermissions,
  affectedEdges: Set<RoadEdge>
): void {

  for (
    const [
      junctionId,
      incomingEdges,
    ]
    of junctionRequests
  ) {

    const permittedMovements =
      junctionPermissions.get(
        junctionId
      )
      ?? [];


    for (
      const [
        incomingEdge,
        outgoingMovements,
      ]
      of incomingEdges
    ) {

      for (
        const [
          outgoingEdge,
          movementUpdates,
        ]
        of outgoingMovements
      ) {

        const isPermitted =
          permittedMovements.some(
            movement =>
              movement.incomingEdge
                === incomingEdge
              &&
              movement.outgoingEdge
                === outgoingEdge
          );


        if (isPermitted) {
          continue;
        }


        /*
         * This movement was denied.
         *
         * None of its requesting vehicles
         * may cross the incoming-edge
         * boundary during this timestep.
         */
        for (
          const update
          of movementUpdates
        ) {

          const vehicle =
            update.vehicle;


          const maximumTravelMeters =
            incomingEdge.lengthMeters
            - vehicle.positionMeters;


        update.travelMeters =
            maximumTravelMeters;

        /*
           * For V1, a vehicle denied entry
           * finishes this timestep stopped
           * at or before the junction.
           */
        update.nextSpeedMps =
            0;


        affectedEdges.add(
            incomingEdge
            );
        }
      }
    }
  }
}

// Valides vehicles whose junction entry request was permitted
function applyJunctionEntrySafety(
  updates: EdgeUpdates,
  junctionRequests: JunctionRequests,
  junctionPermissions: JunctionPermissions,
  affectedEdges: Set<RoadEdge>
): void {

  /*
   * Only permitted movements need
   * downstream-entry safety checks.
   */
  for (
    const [
      junctionId,
      permittedMovements,
    ]
    of junctionPermissions
  ) {

    const junction =
      junctionRequests.get(
        junctionId
      )!;


    for (
      const movement
      of permittedMovements
    ) {

      const {
        incomingEdge,
        outgoingEdge,
      } = movement;


      const movementUpdates =
        junction
          .get(incomingEdge)!
          .get(outgoingEdge)!;

      /*
       * Find the rear-most vehicle already
       * on the outgoing edge.
       *
       * EdgeUpdates are ordered:
       *
       * rear-most -> front-most
       */
      const outgoingEdgeUpdates =
        updates.get(
          outgoingEdge
        );


      let leaderPosition:
        number
        | null =
        null;

      let leaderSpeedMps:
        number =
        0;


      if (
        outgoingEdgeUpdates
        &&
        outgoingEdgeUpdates.length > 0
      ) {

        const rearUpdate =
          outgoingEdgeUpdates[0];

        leaderPosition =
          rearUpdate.vehicle.positionMeters
          + rearUpdate.travelMeters;

        leaderSpeedMps =
          rearUpdate.nextSpeedMps;
      }


      /*
       * movementUpdates are stored:
       *
       * front-most -> rear-most
       *
       * So after resolving one entrant,
       * that entrant becomes the leader
       * for the next requesting vehicle.
       */
      for (
        const update
        of movementUpdates
      ) {

        const vehicle =
          update.vehicle;


        /*
         * Candidate position measured
         * relative to the outgoing edge.
         *
         * Example:
         *
         * incoming edge length = 100
         * candidate position    = 103
         *
         * entry position = 3
         */
        const candidateEntryPosition =
          (
            vehicle.positionMeters
            + update.travelMeters
          )
          - incomingEdge.lengthMeters;


        /*
         * If there is already a vehicle
         * ahead on the outgoing edge,
         * preserve the hard spacing
         * invariant across the boundary.
         */
        if (
          leaderPosition !== null
        ) {

          const maximumEntryPosition =
            leaderPosition
            - INITIAL_SPACING_METERS;


          if (
            candidateEntryPosition
            > maximumEntryPosition
          ) {

            /*
             * Convert the allowed position
             * on the outgoing edge back into
             * travel distance from the
             * vehicle's current position on
             * the incoming edge.
             */
            const maximumTravelMeters =
              incomingEdge.lengthMeters
              + maximumEntryPosition
              - vehicle.positionMeters;


            update.travelMeters =
                maximumTravelMeters;


            update.nextSpeedMps =
              Math.min(
                update.nextSpeedMps,
                leaderSpeedMps
              );

            affectedEdges.add(
                incomingEdge
            );
          }
        }


        /*
         * Recalculate where this vehicle
         * actually ends after any correction.
         */
        const resolvedEntryPosition =
          (
            vehicle.positionMeters
            + update.travelMeters
          )
          - incomingEdge.lengthMeters;


        /*
         * If it can no longer enter the
         * outgoing edge, vehicles behind it
         * cannot pass it.
         *
         * The final same-edge correction
         * will propagate this restriction
         * backward.
         */
        if (
          resolvedEntryPosition
          <= 0
        ) {
          break;
        }


        /*
         * This vehicle is now the nearest
         * leader for the next vehicle trying
         * to enter through this movement.
         */
        leaderPosition =
          resolvedEntryPosition;

        leaderSpeedMps =
          update.nextSpeedMps;
      }
    }
  }
}

function commitVehicleUpdates(
  occupancy: EdgeOccupancy,
  updates: EdgeUpdates
): number {

  let completedVehicles =
    0;


  /*
   * First commit each vehicle's resolved
   * position and speed.
   *
   * Membership in occupancy does not
   * change yet.
   */
  for (
    const edgeUpdates
    of updates.values()
  ) {

    for (
      const update
      of edgeUpdates
    ) {

      const vehicle =
        update.vehicle;

      vehicle.positionMeters +=
        update.travelMeters;

      vehicle.speedMps =
        update.nextSpeedMps;
    }
  }


  /*
   * Now handle vehicles that actually
   * crossed the front of their current edge.
   *
   * Iterate updates, not occupancy, because
   * occupancy is being modified here.
   */
  for (
    const [
      edge,
      edgeUpdates,
    ]
    of updates
  ) {

    const edgeVehicles =
      occupancy.get(
        edge
      )!;


    /*
     * Crossing vehicles can only be at
     * the front of the ordered edge.
     */
    while (
      edgeVehicles.length > 0
    ) {

      const vehicle =
        edgeVehicles[
          edgeVehicles.length - 1
        ];


      const isFinalRouteEdge =
        vehicle.routeIndex
        === vehicle.route.length - 1;


      /*
       * Final edge:
       * reaching the end completes the trip.
       */
      if (
        isFinalRouteEdge
      ) {

        if (
          vehicle.positionMeters
          <
          edge.lengthMeters
        ) {
          break;
        }

        edgeVehicles.pop();

        completedVehicles++;

        continue;
      }


      /*
       * Intermediate edge:
       * exactly at the boundary means
       * remain on this edge.
       */
      if (
        vehicle.positionMeters
        <=
        edge.lengthMeters
      ) {
        break;
      }


      edgeVehicles.pop();


      vehicle.positionMeters -=
        edge.lengthMeters;

      vehicle.routeIndex++;


      const outgoingEdge =
        vehicle.route[
          vehicle.routeIndex
        ];


      let outgoingVehicles =
        occupancy.get(
          outgoingEdge
        );

      if (!outgoingVehicles) {

        outgoingVehicles =
          [];

        occupancy.set(
          outgoingEdge,
          outgoingVehicles
        );
      }


      /*
       * We process crossing vehicles
       * front-most first.
       *
       * Repeated unshift therefore preserves
       * rear-most -> front-most ordering.
       */
      outgoingVehicles.unshift(
        vehicle
      );
    }
  }


  return completedVehicles;
}


/*
 * Advances the entire traffic simulation by one timestep.
 *
 * IMPORTANT ARCHITECTURAL RULE:
 *
 * Traffic decisions are calculated first using candidate state.
 * The actual Vehicle objects are not mutated until the final
 * commit phase.
 *
 * This gives the timestep the following structure:
 *
 *   actual state at time t
 *          ↓
 *   calculate candidate movement using IDM
 *          ↓
 *   enforce hard same-edge spacing
 *          ↓
 *   identify attempted junction crossings
 *          ↓
 *   determine which movements have junction permission
 *          ↓
 *   stop denied movements at the junction boundary
 *          ↓
 *   ensure permitted movements have enough downstream space
 *          ↓
 *   propagate any resulting corrections backward on affected edges
 *          ↓
 *   commit the final resolved state
 *          ↓
 *   actual state at time t + Δt
 *
 *
 * The major separation is:
 *
 *   1. Vehicle physics proposes movement.
 *   2. Hard traffic constraints modify those proposals.
 *   3. Only after every constraint has been resolved do we
 *      update the actual simulation state.
 */
export function stepSimulation(
  occupancy: EdgeOccupancy,
  deltaSeconds: number
): number {

  /*
   * PHASE 1 — CALCULATE CANDIDATE VEHICLE MOVEMENT
   *
   * For every vehicle currently in the simulation:
   *
   *   1. Find the vehicle's current leader.
   *      The leader may be:
   *        - another vehicle farther ahead on the same edge, or
   *        - the nearest relevant vehicle on a downstream route edge
   *          within the configured lookahead distance.
   *
   *   2. Use IDM to calculate the vehicle's acceleration based on:
   *        - current speed,
   *        - desired/free-flow speed,
   *        - leader speed,
   *        - gap to the leader.
   *
   *   3. Use ballistic constant-acceleration integration to calculate:
   *        - how far the vehicle proposes to travel this timestep,
   *        - its proposed speed at the end of the timestep.
   *
   * The result is stored in VehicleUpdate objects.
   *
   * At this point:
   *
   *   vehicle.positionMeters
   *   vehicle.speedMps
   *   vehicle.routeIndex
   *
   * are still the actual values from time t.
   *
   * The proposed future state exists only in `updates`.
   */
  const updates =
    calculateVehicleUpdates(
      occupancy,
      deltaSeconds
    );


  /*
   * PHASE 2 — ENFORCE HARD SAME-EDGE SPACING
   *
   * IDM is a behavioral car-following model. It normally causes a
   * follower to slow before reaching its leader, but numerical
   * integration and finite timesteps can still produce a candidate
   * position that violates our hard minimum spacing requirement.
   *
   * Therefore, before performing any junction processing, enforce:
   *
   *   follower position
   *       <=
   *   leader position - INITIAL_SPACING_METERS
   *
   * for vehicles currently occupying the same edge.
   *
   * The correction is propagated from the front of each edge
   * backward toward the rear so that, if a leader is corrected,
   * its follower is checked against that already-corrected position.
   *
   * This phase only guarantees spacing between vehicles that are
   * currently on the SAME edge.
   *
   * It does NOT yet guarantee spacing between:
   *
   *   a vehicle entering an outgoing edge
   *
   * and
   *
   *   a vehicle already occupying that outgoing edge.
   *
   * Cross-edge spacing is handled later during junction-entry safety.
   *
   * Actual Vehicle objects are still not mutated.
   */
  enforceSameEdgeSpacing(
    updates
  );


  /*
   * PHASE 3 — BUILD JUNCTION ENTRY REQUESTS
   *
   * After candidate movement and same-edge correction, determine
   * which vehicles are proposing to move beyond the end of their
   * current edge during this timestep.
   *
   * A vehicle creates a junction request only when its candidate
   * position is strictly beyond the incoming-edge boundary:
   *
   *   candidatePosition > incomingEdge.lengthMeters
   *
   * Reaching the boundary exactly does not constitute a crossing.
   *
   * Requests are grouped using the hierarchy:
   *
   *   Junction
   *      → Incoming Edge
   *          → Outgoing Edge
   *              → VehicleUpdate[]
   *
   * This means that for any junction we can determine:
   *
   *   - which incoming approaches are requesting entry,
   *   - which outgoing edge each vehicle wants to use,
   *   - which vehicles belong to each requested movement.
   *
   * A "movement" is therefore:
   *
   *   incomingEdge → junction → outgoingEdge
   *
   * Keeping requests grouped by movement is important because
   * junction control operates on movements rather than individual
   * vehicles.
   *
   * In the future, this same structure can support signal-controlled
   * movement permissions without changing the rest of the timestep
   * architecture.
   */
  const junctionRequests =
    buildJunctionRequests(
      updates
    );


  /*
   * PHASE 4 — RESOLVE JUNCTION ADMISSION
   *
   * For every junction that received one or more requests, determine
   * which requested movement is allowed to proceed during this
   * timestep.
   *
   * Current V1 policy:
   *
   *   - at most one movement is permitted per junction per timestep;
   *   - a permitted movement identifies an incoming edge and an
   *     outgoing edge;
   *   - all vehicles requesting that movement remain candidates
   *     for entry, subject to physical downstream-space constraints.
   *
   * Example:
   *
   *   E1 → E2   requested
   *   E3 → E4   requested
   *
   * The resolver may return:
   *
   *   E1 → E2   permitted
   *   E3 → E4   denied
   *
   * This method determines RIGHT-OF-WAY only.
   *
   * It does NOT yet determine whether the permitted vehicles can
   * physically fit onto the outgoing edge.
   *
   * That is handled separately in the junction-entry safety phase.
   *
   * Future signal logic can replace or extend this admission policy
   * while keeping the request and physical-safety layers unchanged.
   */
  const junctionPermissions =
    resolveJunctionRequests(
      junctionRequests
    );


  /*
   * Track only the incoming edges whose candidate movement is changed
   * by junction processing.
   *
   * Why this is needed:
   *
   * Suppose the front vehicle on an incoming edge originally proposed
   * to move through the junction, but junction logic later shortens
   * its movement.
   *
   * Vehicles behind it may now also need to be pulled backward to
   * preserve same-edge spacing.
   *
   * However, there is no reason to run another spacing pass over
   * every edge in the entire simulation.
   *
   * Therefore, junction-processing methods add an incoming edge to
   * this set whenever they shorten the proposed travel of a vehicle
   * on that edge.
   *
   * After junction processing is complete, only these edges require
   * another backward spacing propagation.
   */
  const affectedEdges =
    new Set<RoadEdge>();


  /*
   * PHASE 5 — APPLY JUNCTION PERMISSIONS
   *
   * Process movements that requested junction entry but were NOT
   * granted permission.
   *
   * A denied vehicle is not allowed to move beyond the end of its
   * current incoming edge.
   *
   * Its candidate travel is therefore reduced so that:
   *
   *   final candidate position == incomingEdge.lengthMeters
   *
   * In other words, the vehicle is stopped exactly at the junction
   * boundary but remains on its current edge.
   *
   * Its candidate end speed is also set to zero.
   *
   * Any incoming edge modified here is added to `affectedEdges`
   * because shortening the front vehicle's movement may require
   * corresponding corrections to vehicles behind it.
   *
   * This method modifies VehicleUpdate candidate values only.
   * Actual Vehicle objects remain unchanged.
   */
  applyJunctionPermissions(
    junctionRequests,
    junctionPermissions,
    affectedEdges
  );


  /*
   * PHASE 6 — APPLY PHYSICAL JUNCTION-ENTRY SAFETY
   *
   * A movement having permission does NOT automatically mean that
   * its vehicles can physically enter the outgoing edge.
   *
   * Permission answers:
   *
   *   "Does this movement have right-of-way?"
   *
   * This phase answers:
   *
   *   "Given the vehicles already on the outgoing edge, how far can
   *    the permitted vehicles actually move without violating the
   *    hard spacing requirement?"
   *
   * For each permitted movement:
   *
   *   1. Inspect the rear-most vehicle already occupying the
   *      outgoing edge, if one exists.
   *
   *   2. Determine the maximum safe entry position behind that
   *      vehicle using INITIAL_SPACING_METERS.
   *
   *   3. Process requesting vehicles from front-most to rear-most.
   *
   *   4. If a requesting vehicle proposed to move farther into the
   *      outgoing edge than safely allowed, shorten its travel.
   *
   *   5. Once one entrant has been resolved, that entrant becomes
   *      the effective leader for the next vehicle behind it.
   *
   * Example:
   *
   *   outgoing edge already contains X
   *
   *       Junction → A → B → X
   *
   * where A and B are attempting to enter.
   *
   * The safety calculation first places A safely behind X,
   * then places B safely behind A.
   *
   * A vehicle may therefore:
   *
   *   - enter the outgoing edge fully as proposed,
   *   - enter only partway,
   *   - be reduced back to the junction boundary.
   *
   * If candidate travel is shortened, the incoming edge is added
   * to `affectedEdges`.
   *
   * Again, only candidate VehicleUpdate values are modified here.
   * Actual Vehicle state is still unchanged.
   */
  applyJunctionEntrySafety(
    updates,
    junctionRequests,
    junctionPermissions,
    affectedEdges
  );


  /*
   * PHASE 7 — PROPAGATE JUNCTION CORRECTIONS BACKWARD
   *
   * Junction processing may have shortened the movement of vehicles
   * near the front of an incoming edge.
   *
   * Example:
   *
   *   C ---- B ---- A ----> junction
   *
   * A originally proposed to move through the junction.
   *
   * If junction logic later stops or slows A, B's previously valid
   * candidate position may now be too close to A.
   *
   * Correcting B may then require correcting C, and so on.
   *
   * Therefore, run the same hard same-edge spacing propagation again.
   *
   * Unlike the initial spacing pass, this pass does NOT inspect every
   * occupied edge.
   *
   * It only processes edges contained in `affectedEdges`, because
   * those are the only edges whose front-end candidate movement was
   * changed after the original spacing pass.
   *
   * After this phase, all candidate positions are considered final.
   *
   * No further traffic-control or safety decisions should occur
   * during commit.
   */
  enforceSameEdgeSpacing(
    updates,
    affectedEdges
  );


  /*
   * PHASE 8 — COMMIT THE RESOLVED TIMESTEP
   *
   * All candidate movement has now passed through:
   *
   *   - IDM / ballistic movement,
   *   - same-edge hard spacing,
   *   - junction admission,
   *   - denied-movement handling,
   *   - downstream entry safety,
   *   - backward spacing propagation.
   *
   * Therefore, the candidate state can now become the actual
   * simulation state.
   *
   * commitVehicleUpdates() performs only state mutation.
   * It must NOT make new traffic decisions.
   *
   * For each vehicle it:
   *
   *   - applies the resolved travel distance,
   *   - applies the resolved end-of-timestep speed,
   *   - leaves the vehicle on its current edge if it did not cross,
   *   - moves it to the next route edge if it crossed the junction,
   *   - increments routeIndex when a transition occurs,
   *   - preserves occupancy ordering,
   *   - removes/counts vehicles that reached the end of their route.
   *
   * Intermediate-edge boundary rule:
   *
   *   position < edge.length
   *       → vehicle remains on the edge
   *
   *   position == edge.length
   *       → vehicle remains on the edge at the junction boundary
   *
   *   position > edge.length
   *       → vehicle entered the next edge
   *
   * Final-route-edge rule:
   *
   *   position >= edge.length
   *       → trip is complete
   *
   * The returned value is the number of vehicles that completed
   * their routes during this timestep.
   */
  const completedVehicles =
    commitVehicleUpdates(
      occupancy,
      updates
    );


  return completedVehicles;
}
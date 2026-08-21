import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import './App.css';

import TrafficMap
  from './components/TrafficMap';

import {
  buildRoadGraph,
} from './model/graph';

import type {
  RoadGraph,
} from './model/graph';

import {
  loadRoadNetwork,
} from './data/roadNetworkLoader';

import {
  searchLocation,
  searchLocationSuggestions,
} from './data/geocoding';

import type {
  LocationResult,
} from './data/geocoding';

import {
  buildRoadMetadataIndex,
} from './application/roadMetadata';

import {
  getEdgePhysicalSegmentKey,
} from './application/roadIdentity';

import type {
  RoadMetadataIndex,
} from './application/roadMetadata';

import type {
  RoadSelection,
  RoadSpeedView,
  VehicleView,
} from './application/viewModels';

import type {
  ScenarioMetrics,
} from './scenario/ScenarioExperiment';

import type {
  SimulationWorkerCommand,
  SimulationWorkerResponse,
} from './worker/simulationProtocol.ts';


const DEFAULT_LATITUDE =
  30.2672;

const DEFAULT_LONGITUDE =
  -97.7431;

const DEFAULT_LOCATION_NAME =
  'Downtown Austin, Texas';

const ROAD_RADIUS_METERS =
  1500;

const DEFAULT_VEHICLE_COUNT =
  500;

const EXPERIMENT_SEED =
  20260821;


function countDirectedEdges(
  graph: RoadGraph
): number {

  let count =
    0;

  for (
    const outgoingEdges
    of graph.adjacency.values()
  ) {

    count +=
      outgoingEdges.length;
  }

  return count;
}


type PendingSimulationStatus =
  | {
      experimentId: number;
      kind: 'LOAD';
      nodeCount: number;
      directedEdgeCount: number;
    }
  | {
      experimentId: number;
      kind: 'RESTART';
    };


function App() {

  const [
    query,
    setQuery,
  ] =
    useState(
      DEFAULT_LOCATION_NAME
    );

  const [
    latitude,
    setLatitude,
  ] =
    useState(
      DEFAULT_LATITUDE
    );

  const [
    longitude,
    setLongitude,
  ] =
    useState(
      DEFAULT_LONGITUDE
    );

  const [
    locationName,
    setLocationName,
  ] =
    useState(
      DEFAULT_LOCATION_NAME
    );

  const [
    graph,
    setGraph,
  ] =
    useState<
      RoadGraph
      | null
    >(
      null
    );

  const [
    roadMetadata,
    setRoadMetadata,
  ] =
    useState<
      RoadMetadataIndex
    >(
      new Map()
    );

  const [
    vehicles,
    setVehicles,
  ] =
    useState<
      VehicleView[]
    >(
      []
    );

  const [
    roadSpeeds,
    setRoadSpeeds,
  ] =
    useState<
      RoadSpeedView[]
    >(
      []
    );

  const [
    scenarioMetrics,
    setScenarioMetrics,
  ] =
    useState<
      ScenarioMetrics
      | null
    >(
      null
    );

  const [
    baselineMetrics,
    setBaselineMetrics,
  ] =
    useState<
      ScenarioMetrics
      | null
    >(
      null
    );

  const [
    vehicleCount,
    setVehicleCount,
  ] =
    useState(
      DEFAULT_VEHICLE_COUNT
    );

  const [
    running,
    setRunning,
  ] =
    useState(
      true
    );

  const [
    comparisonEnabled,
    setComparisonEnabled,
  ] =
    useState(
      false
    );

  const [
    selectedRoad,
    setSelectedRoad,
  ] =
    useState<
      RoadSelection
      | null
    >(
      null
    );

  const [
    closedSegmentKeys,
    setClosedSegmentKeys,
  ] =
    useState<
      string[]
    >(
      []
    );

  const [
    status,
    setStatus,
  ] =
    useState(
      'Loading road network...'
    );

  const [
    suggestions,
    setSuggestions,
  ] =
    useState<
      LocationResult[]
    >(
      []
    );

  const [
    suggestionsOpen,
    setSuggestionsOpen,
  ] =
    useState(
      false
    );

  const [
    searchingLocations,
    setSearchingLocations,
  ] =
    useState(
      false
    );

  const [
    highlightedSuggestion,
    setHighlightedSuggestion,
  ] =
    useState(
      -1
    );


  const simulationWorkerRef =
    useRef<
      Worker
      | null
    >(
      null
    );

  const currentExperimentIdRef =
    useRef(
      0
    );

  const runningRef =
    useRef(
      running
    );

  const pendingSimulationStatusRef =
    useRef<
      PendingSimulationStatus
      | null
    >(
      null
    );

  const suppressAutocompleteRef =
    useRef(
      false
    );


  useEffect(() => {

    runningRef.current =
      running;

  }, [running]);


  useEffect(() => {

    const worker =
      new Worker(
        new URL(
          './worker/simulation.worker.ts',
          import.meta.url
        ),
        {
          type: 'module',
        }
      );


    simulationWorkerRef.current =
      worker;


    worker.onmessage =
      (
        event:
          MessageEvent<SimulationWorkerResponse>
      ) => {

        const message =
          event.data;


        if (
          message.experimentId
          !== null
          &&
          message.experimentId
          !== currentExperimentIdRef.current
        ) {
          return;
        }


        switch (
          message.type
        ) {

          case 'STATE': {

            setVehicles(
              message.vehicles
            );

            setScenarioMetrics(
              message.scenarioMetrics
            );

            setBaselineMetrics(
              message.baselineMetrics
            );


            const pending =
              pendingSimulationStatusRef.current;


            if (
              pending
              &&
              pending.experimentId
              === message.experimentId
            ) {

              if (
                pending.kind
                === 'LOAD'
              ) {

                setStatus(
                  `Loaded `
                  + `${pending.nodeCount.toLocaleString()} nodes, `
                  + `${pending.directedEdgeCount.toLocaleString()} directed edges. `
                  + `${message.initialVehicleCount.toLocaleString()} seeded agents initialized.`
                );

              } else {

                setStatus(
                  `Experiment restarted with `
                  + `${message.initialVehicleCount.toLocaleString()} `
                  + `deterministically seeded agents.`
                );
              }


              pendingSimulationStatusRef.current =
                null;
            }

            return;
          }


          case 'ROAD_SPEEDS':

            setRoadSpeeds(
              message.roadSpeeds
            );

            return;


          case 'COMPLETE':

            runningRef.current =
              false;

            setRunning(
              false
            );

            return;


          case 'ERROR':

            console.error(
              message.message
            );

            pendingSimulationStatusRef.current =
              null;

            runningRef.current =
              false;

            setRunning(
              false
            );

            setStatus(
              message.message
            );

            return;
        }
      };


    worker.onerror =
      event => {

        console.error(
          event
        );

        pendingSimulationStatusRef.current =
          null;

        runningRef.current =
          false;

        setRunning(
          false
        );

        setStatus(
          'Simulation worker failed.'
        );
      };


    return () => {

      worker.terminate();


      if (
        simulationWorkerRef.current
        === worker
      ) {

        simulationWorkerRef.current =
          null;
      }
    };

  }, []);


  function postSimulationCommand(
    command: SimulationWorkerCommand
  ): boolean {

    const worker =
      simulationWorkerRef.current;


    if (!worker) {

      runningRef.current =
        false;

      setRunning(
        false
      );

      setStatus(
        'Simulation worker is not ready.'
      );

      return false;
    }


    worker.postMessage(
      command
    );

    return true;
  }


  function initializeExperiment(
    targetGraph: RoadGraph,
    closures:
      string[],
    requestedVehicleCount:
      number,
    compare:
      boolean,
    startRunning:
      boolean = true
  ): number | null {

    const experimentId =
      currentExperimentIdRef.current
      + 1;


    const posted =
      postSimulationCommand({
        type: 'INITIALIZE',
        experimentId,
        graph:
          targetGraph,
        closedSegmentKeys:
          closures,
        requestedVehicleCount,
        seed:
          EXPERIMENT_SEED,
        comparisonEnabled:
          compare,
        running:
          startRunning,
      });


    if (!posted) {
      return null;
    }


    currentExperimentIdRef.current =
      experimentId;


    return experimentId;
  }


  function resetExperiment(
    closures:
      string[],
    requestedVehicleCount:
      number,
    compare:
      boolean
  ): number | null {

    const experimentId =
      currentExperimentIdRef.current
      + 1;


    const posted =
      postSimulationCommand({
        type: 'RESET',
        experimentId,
        closedSegmentKeys:
          closures,
        requestedVehicleCount,
        seed:
          EXPERIMENT_SEED,
        comparisonEnabled:
          compare,
        running:
          true,
      });


    if (!posted) {
      return null;
    }


    currentExperimentIdRef.current =
      experimentId;


    return experimentId;
  }


  async function loadLocation(
    selectedLocation?:
      LocationResult
  ) {

    try {

      setStatus(
        'Finding location...'
      );


      const location =
        selectedLocation
        ??
        await searchLocation(
          query
        );


      suppressAutocompleteRef.current =
        true;


      setQuery(
        location.displayName
      );

      setSuggestions(
        []
      );

      setSuggestionsOpen(
        false
      );

      setHighlightedSuggestion(
        -1
      );


      setStatus(
        'Downloading OpenStreetMap road network...'
      );


      const osm =
        await loadRoadNetwork(
          location.latitude,
          location.longitude,
          ROAD_RADIUS_METERS
        );


      setStatus(
        'Building directed road graph...'
      );


      const nextGraph =
        buildRoadGraph(
          osm
        );


      const nextMetadata =
        buildRoadMetadataIndex(
          osm
        );


      setLatitude(
        location.latitude
      );

      setLongitude(
        location.longitude
      );

      setLocationName(
        location.displayName
      );

      setGraph(
        nextGraph
      );

      setRoadMetadata(
        nextMetadata
      );

      setSelectedRoad(
        null
      );

      setClosedSegmentKeys(
        []
      );


      const experimentId =
        initializeExperiment(
          nextGraph,
          [],
          vehicleCount,
          comparisonEnabled
        );


      if (
        experimentId
        === null
      ) {
        return;
      }


      pendingSimulationStatusRef.current = {
        experimentId,
        kind: 'LOAD',
        nodeCount:
          nextGraph.nodes.size,
        directedEdgeCount:
          countDirectedEdges(
            nextGraph
          ),
      };


      runningRef.current =
        true;

      setRunning(
        true
      );

    } catch (error) {

      console.error(
        error
      );


      setStatus(
        error instanceof Error
        ? error.message
        : 'Could not load location.'
      );
    }
  }


  /*
   * Initial Austin load.
   *
   * roadNetworkLoader.ts de-duplicates the request across React
   * development StrictMode remounts, while osm.ts remains untouched.
   */
  useEffect(() => {

    let cancelled =
      false;


    async function loadInitialNetwork() {

      try {

        const osm =
          await loadRoadNetwork(
            DEFAULT_LATITUDE,
            DEFAULT_LONGITUDE,
            ROAD_RADIUS_METERS
          );


        if (cancelled) {
          return;
        }


        const nextGraph =
          buildRoadGraph(
            osm
          );


        const nextMetadata =
          buildRoadMetadataIndex(
            osm
          );


        setGraph(
          nextGraph
        );

        setRoadMetadata(
          nextMetadata
        );


        const experimentId =
          initializeExperiment(
            nextGraph,
            [],
            DEFAULT_VEHICLE_COUNT,
            false,
            runningRef.current
          );


        if (
          experimentId
          === null
        ) {
          return;
        }


        pendingSimulationStatusRef.current = {
          experimentId,
          kind: 'LOAD',
          nodeCount:
            nextGraph.nodes.size,
          directedEdgeCount:
            countDirectedEdges(
              nextGraph
            ),
        };

      } catch (error) {

        if (cancelled) {
          return;
        }


        console.error(
          error
        );


        setStatus(
          error instanceof Error
          ? error.message
          : 'Could not load initial road network.'
        );
      }
    }


    loadInitialNetwork();


    return () => {

      cancelled =
        true;
    };

  }, []);


  /*
   * MapTiler autocomplete is an application service, kept completely
   * separate from the OSM road-network adapter.
   */
  useEffect(() => {

    if (
      suppressAutocompleteRef.current
    ) {

      suppressAutocompleteRef.current =
        false;

      return;
    }


    const trimmed =
      query.trim();


    if (
      trimmed.length < 3
    ) {

      setSuggestions(
        []
      );

      setSuggestionsOpen(
        false
      );

      setHighlightedSuggestion(
        -1
      );

      return;
    }


    const controller =
      new AbortController();


    const timer =
      window.setTimeout(
        async () => {

          try {

            setSearchingLocations(
              true
            );


            const results =
              await searchLocationSuggestions(
                trimmed,
                controller.signal
              );


            setSuggestions(
              results
            );

            setSuggestionsOpen(
              results.length > 0
            );

            setHighlightedSuggestion(
              -1
            );

          } catch (error) {

            if (
              error instanceof DOMException
              &&
              error.name
              === 'AbortError'
            ) {
              return;
            }


            console.error(
              error
            );

          } finally {

            if (
              !controller
                .signal
                .aborted
            ) {

              setSearchingLocations(
                false
              );
            }
          }
        },
        300
      );


    return () => {

      window.clearTimeout(
        timer
      );

      controller.abort();
    };

  }, [query]);




  function restartExperiment(
    nextVehicleCount:
      number = vehicleCount,
    nextClosures:
      string[] = closedSegmentKeys,
    nextComparison:
      boolean = comparisonEnabled
  ) {

    if (!graph) {
      return;
    }


    const experimentId =
      resetExperiment(
        nextClosures,
        nextVehicleCount,
        nextComparison
      );


    if (
      experimentId
      === null
    ) {
      return;
    }


    pendingSimulationStatusRef.current = {
      experimentId,
      kind: 'RESTART',
    };


    runningRef.current =
      true;

    setRunning(
      true
    );
  }


  function updateVehicleCount(
    nextCount: number
  ) {

    setVehicleCount(
      nextCount
    );


    restartExperiment(
      nextCount,
      closedSegmentKeys,
      comparisonEnabled
    );
  }


  function toggleComparison() {

    const nextEnabled =
      !comparisonEnabled;


    setComparisonEnabled(
      nextEnabled
    );


    restartExperiment(
      vehicleCount,
      closedSegmentKeys,
      nextEnabled
    );
  }


  function setRoadClosed(
    road: RoadSelection,
    closed: boolean
  ) {

    const nextClosures =
      closed
      ? Array.from(
          new Set([
            ...closedSegmentKeys,
            road.segmentKey,
          ])
        )
      : closedSegmentKeys.filter(
          segmentKey =>
            segmentKey
            !== road.segmentKey
        );


    setClosedSegmentKeys(
      nextClosures
    );


    restartExperiment(
      vehicleCount,
      nextClosures,
      comparisonEnabled
    );
  }


  function resetScenario() {

    setClosedSegmentKeys(
      []
    );

    setSelectedRoad(
      null
    );


    restartExperiment(
      vehicleCount,
      [],
      comparisonEnabled
    );
  }


  const selectedIsClosed =
    selectedRoad
    ? closedSegmentKeys.includes(
        selectedRoad.segmentKey
      )
    : false;


  const closedRoads =
    useMemo(
      () =>
        closedSegmentKeys.map(
          segmentKey => {

            let speedLimitMps =
              0;


            if (graph) {

              search:
              for (
                const outgoingEdges
                of graph.adjacency.values()
              ) {

                for (
                  const edge
                  of outgoingEdges
                ) {

                  if (
                    getEdgePhysicalSegmentKey(
                      edge
                    )
                    === segmentKey
                  ) {

                    speedLimitMps =
                      edge.speedLimitMps;

                    break search;
                  }
                }
              }
            }


            return {
              segmentKey,

              displayName:
                roadMetadata.get(
                  segmentKey
                )?.displayName
                ??
                'Unnamed road',

              speedLimitMps,
            };
          }
        ),
      [
        closedSegmentKeys,
        roadMetadata,
        graph,
      ]
    );


  return (
    <div className="app-shell">

      <header className="topbar">

        <div className="brand">

          <h1>
            TrafficTwin
          </h1>

          <span className="product-descriptor">
            Urban Traffic Digital Twin
            &amp; Intervention Simulator
          </span>

        </div>


        <div className="search-group">

          <div className="location-search">

            <input
              value={
                query
              }
              autoComplete="off"
              placeholder="Search city, street, address..."
              onFocus={
                () => {

                  if (
                    suggestions.length > 0
                  ) {

                    setSuggestionsOpen(
                      true
                    );
                  }
                }
              }
              onChange={
                event => {

                  setQuery(
                    event.target.value
                  );

                  setHighlightedSuggestion(
                    -1
                  );
                }
              }
              onKeyDown={
                event => {

                  if (
                    event.key
                    === 'ArrowDown'
                  ) {

                    event.preventDefault();


                    if (
                      suggestions.length === 0
                    ) {
                      return;
                    }


                    setSuggestionsOpen(
                      true
                    );


                    setHighlightedSuggestion(
                      current =>
                        Math.min(
                          current + 1,
                          suggestions.length - 1
                        )
                    );

                    return;
                  }


                  if (
                    event.key
                    === 'ArrowUp'
                  ) {

                    event.preventDefault();


                    setHighlightedSuggestion(
                      current =>
                        Math.max(
                          current - 1,
                          0
                        )
                    );

                    return;
                  }


                  if (
                    event.key
                    === 'Escape'
                  ) {

                    setSuggestionsOpen(
                      false
                    );

                    return;
                  }


                  if (
                    event.key
                    === 'Enter'
                  ) {

                    event.preventDefault();


                    if (
                      suggestionsOpen
                      &&
                      highlightedSuggestion
                      >= 0
                    ) {

                      loadLocation(
                        suggestions[
                          highlightedSuggestion
                        ]
                      );

                    } else if (
                      suggestionsOpen
                      &&
                      suggestions.length > 0
                    ) {

                      loadLocation(
                        suggestions[0]
                      );

                    } else {

                      loadLocation();
                    }
                  }
                }
              }
            />


            {
              searchingLocations
              && (
                <div className="search-loading">
                  Searching...
                </div>
              )
            }


            {
              suggestionsOpen
              &&
              suggestions.length > 0
              && (
                <div className="location-suggestions">

                  {
                    suggestions.map(
                      (
                        suggestion,
                        index
                      ) => (
                        <button
                          key={
                            suggestion.id
                          }
                          type="button"
                          className={
                            index
                            === highlightedSuggestion
                            ? 'location-suggestion highlighted'
                            : 'location-suggestion'
                          }
                          onMouseDown={
                            event => {

                              event.preventDefault();
                            }
                          }
                          onClick={
                            () =>
                              loadLocation(
                                suggestion
                              )
                          }
                        >

                          <span className="suggestion-name">
                            {
                              suggestion.displayName
                            }
                          </span>

                          <span className="suggestion-type">
                            {
                              suggestion.placeType
                            }
                          </span>

                        </button>
                      )
                    )
                  }

                </div>
              )
            }

          </div>


          <button
            className="load-button"
            type="button"
            onClick={
              () =>
                loadLocation()
            }
          >
            Load location
          </button>

        </div>

      </header>


      <main className="workspace">

        <aside className="sidebar">

          <section>

            <span className="section-label">
              LOCATION
            </span>

            <strong className="location-name">
              {locationName}
            </strong>

            <p className="status">
              {status}
            </p>

          </section>


          <section>

            <span className="section-label">
              SIMULATION
            </span>

            <label className="control-label">

              <span>
                Vehicle agents
              </span>

              <strong>
                {vehicleCount}
              </strong>

            </label>


            <input
              className="range-control"
              type="range"
              min="100"
              max="1500"
              step="100"
              value={
                vehicleCount
              }
              onChange={
                event =>
                  updateVehicleCount(
                    Number(
                      event.target.value
                    )
                  )
              }
            />


            <button
              className="simulation-button"
              type="button"
              onClick={
                () => {

                  const nextRunning =
                    !running;


                  runningRef.current =
                    nextRunning;

                  setRunning(
                    nextRunning
                  );


                  postSimulationCommand({
                    type: 'SET_RUNNING',
                    experimentId:
                      currentExperimentIdRef.current,
                    running:
                      nextRunning,
                  });
                }
              }
            >
              {
                running
                ? 'Pause simulation'
                : 'Resume simulation'
              }
            </button>


            <label className="comparison-toggle">

              <input
                type="checkbox"
                checked={
                  comparisonEnabled
                }
                disabled={
                  !graph
                }
                onChange={
                  toggleComparison
                }
              />

              <span>
                Compare with baseline
              </span>

            </label>


            <p className="small-note">
              Baseline and intervention runs use the same
              deterministic seed and paired OD agents.
            </p>

          </section>


          <section>

            <span className="section-label">
              ROAD INTERVENTION
            </span>


            {
              selectedRoad
              ? (
                  <div className="road-inspector">

                    <strong>
                      {
                        selectedRoad
                          .displayName
                      }
                    </strong>

                    <span>
                      Speed limit:{' '}
                      {
                        (
                          selectedRoad
                            .speedLimitMps
                          * 2.23694
                        ).toFixed(0)
                      } mph
                    </span>


                    <button
                      type="button"
                      className={
                        selectedIsClosed
                        ? 'open-road-button'
                        : 'close-road-button'
                      }
                      onClick={
                        () =>
                          setRoadClosed(
                            selectedRoad,
                            !selectedIsClosed
                          )
                      }
                    >
                      {
                        selectedIsClosed
                        ? 'Reopen road'
                        : 'Close road'
                      }
                    </button>


                    <p className="small-note left">
                      Applying an intervention restarts the
                      seeded experiment from time 0.
                    </p>

                  </div>
                )
              : (
                  <p className="status">
                    Click a simulation road to select it.
                  </p>
                )
            }


            {
              closedRoads.length > 0
              && (
                <div className="closed-roads">

                  <div className="closed-roads-header">

                    <span>
                      CLOSED ROADS
                    </span>

                    <strong>
                      {
                        closedRoads.length
                      }
                    </strong>

                  </div>


                  {
                    closedRoads.map(
                      road => (
                        <div
                          key={
                            road.segmentKey
                          }
                          className={
                            selectedRoad?.segmentKey
                            === road.segmentKey
                              ? 'closed-road-item selected'
                              : 'closed-road-item'
                          }
                        >

                          <button
                            className="closed-road-select"
                            type="button"
                            onClick={
                              () => {

                                /*
                                 * Preserve current speed detail if the
                                 * selected road is already known.
                                 */
                                if (
                                  selectedRoad?.segmentKey
                                  === road.segmentKey
                                ) {
                                  return;
                                }


                                setSelectedRoad({
                                  segmentKey:
                                    road.segmentKey,

                                  displayName:
                                    road.displayName,

                                  speedLimitMps:
                                    road.speedLimitMps,
                                });
                              }
                            }
                          >
                            {
                              road.displayName
                            }
                          </button>


                          <button
                            className="closed-road-reopen"
                            type="button"
                            onClick={
                              () =>
                                setRoadClosed(
                                  {
                                    segmentKey:
                                      road.segmentKey,

                                    displayName:
                                      road.displayName,

                                    speedLimitMps:
                                      road.speedLimitMps,
                                  },
                                  false
                                )
                            }
                          >
                            Reopen
                          </button>

                        </div>
                      )
                    )
                  }


                  <button
                    className="reset-button"
                    type="button"
                    onClick={
                      resetScenario
                    }
                  >
                    Reset scenario
                  </button>

                </div>
              )
            }

          </section>


          <section>

            <span className="section-label">
              ROAD HEATMAP
            </span>

            <div className="legend-row">
              <span className="line-key free" />
              Near free flow
            </div>

            <div className="legend-row">
              <span className="line-key slow" />
              Slower
            </div>

            <div className="legend-row">
              <span className="line-key congested" />
              Very slow
            </div>

            <div className="legend-row">
              <span className="line-key closed" />
              Closed
            </div>

          </section>


          <section className="data-note">
            Current demand is synthetic and deterministically
            seeded. Road topology comes from OpenStreetMap.
          </section>

        </aside>


        <section className="map-panel">

          <TrafficMap
            latitude={
              latitude
            }
            longitude={
              longitude
            }
            graph={
              graph
            }
            roadMetadata={
              roadMetadata
            }
            vehicles={
              vehicles
            }
            roadSpeeds={
              roadSpeeds
            }
            selectedSegmentKey={
              selectedRoad
                ?.segmentKey
              ?? null
            }
            closedSegmentKeys={
              closedSegmentKeys
            }
            onRoadSelect={
              setSelectedRoad
            }
          />

        </section>


        <aside className="telemetry">

          <span className="section-label">
            {
              comparisonEnabled
              ? 'SCENARIO'
              : 'LIVE NETWORK'
            }
          </span>


          <Metric
            label="Throughput"
            value={
              scenarioMetrics
              ? `${scenarioMetrics.throughputPerMinute.toFixed(1)}/min`
              : '—'
            }
            emphasis
          />


          {
            comparisonEnabled
            && (
              <MetricDelta
                label="Throughput vs baseline"
                value={
                  scenarioMetrics
                    ?.throughputPerMinute
                  ?? null
                }
                baseline={
                  baselineMetrics
                    ?.throughputPerMinute
                  ?? null
                }
              />
            )
          }


          <Metric
            label="Active agents"
            value={
              scenarioMetrics
              ? scenarioMetrics
                  .activeVehicles
                  .toLocaleString()
              : '—'
            }
          />


          <Metric
            label="Completed trips"
            value={
              scenarioMetrics
              ? scenarioMetrics
                  .completedTrips
                  .toLocaleString()
              : '—'
            }
          />


          <Metric
            label="Simulated time"
            value={
              scenarioMetrics
              ? `${Math.floor(
                  scenarioMetrics
                    .simulationTimeSeconds
                )} s`
              : '—'
            }
          />


          {
            comparisonEnabled
            && (
              <>

                <span className="section-label baseline">
                  BASELINE
                </span>


                <Metric
                  label="Baseline throughput"
                  value={
                    baselineMetrics
                    ? `${baselineMetrics.throughputPerMinute.toFixed(1)}/min`
                    : '—'
                  }
                />


                <Metric
                  label="Baseline completed trips"
                  value={
                    baselineMetrics
                    ? baselineMetrics
                        .completedTrips
                        .toLocaleString()
                    : '—'
                  }
                />

              </>
            )
          }


          <section className="metric-note">

            <strong>
              V1 outcome
            </strong>

            <p>
              Throughput is the primary intervention metric.
              Other values here describe run state rather than
              additional traffic-model objectives.
            </p>

          </section>

        </aside>

      </main>


      <footer>
        Simulation roads © OpenStreetMap contributors
        {' · '}
        Basemap &amp; geocoding MapTiler
      </footer>

    </div>
  );
}


function Metric({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {

  return (
    <div
      className={
        emphasis
        ? 'metric metric-emphasis'
        : 'metric'
      }
    >

      <span>
        {label}
      </span>

      <strong>
        {value}
      </strong>

    </div>
  );
}


function MetricDelta({
  label,
  value,
  baseline,
}: {
  label: string;

  value:
    number
    | null;

  baseline:
    number
    | null;
}) {

  const delta =
    (
      value !== null
      &&
      baseline !== null
    )
    ? value
      - baseline
    : null;


  return (
    <div className="metric">

      <span>
        {label}
      </span>

      <strong>
        {
          delta === null
          ? '—'
          : `${delta >= 0 ? '+' : ''}`
            + `${delta.toFixed(1)}/min`
        }
      </strong>

    </div>
  );
}


export default App;

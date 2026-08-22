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

import {
  runHeadlessExperiment,
} from './application/headlessExperimentClient';

import type {
  HeadlessExperimentResponse,
} from './application/headlessExperimentClient';

import {
  toRoadGraphDto,
} from './transport/roadGraphDto';

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

const DEFAULT_EXPERIMENT_SEED =
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
    experimentSeed,
    setExperimentSeed,
  ] =
    useState(
      DEFAULT_EXPERIMENT_SEED
    );

  const [
    headlessRunning,
    setHeadlessRunning,
  ] =
    useState(
      false
    );

  const [
    headlessStatus,
    setHeadlessStatus,
  ] =
    useState(
      'No headless experiment run yet.'
    );

  const [
    headlessResult,
    setHeadlessResult,
  ] =
    useState<
      HeadlessExperimentResponse
      | null
    >(
      null
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

  const headlessRequestTokenRef =
    useRef(
      0
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
    seed:
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
        seed,
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
    seed:
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
        seed,
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

      headlessRequestTokenRef.current +=
        1;

      setHeadlessResult(
        null
      );

      setHeadlessStatus(
        'No headless experiment run yet.'
      );


      const experimentId =
        initializeExperiment(
          nextGraph,
          [],
          vehicleCount,
          experimentSeed,
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
            DEFAULT_EXPERIMENT_SEED,
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
      boolean = comparisonEnabled,
    nextSeed:
      number = experimentSeed
  ) {

    if (!graph) {
      return;
    }


    const experimentId =
      resetExperiment(
        nextClosures,
        nextVehicleCount,
        nextSeed,
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


  function invalidateHeadlessResult() {

    headlessRequestTokenRef.current +=
      1;

    setHeadlessResult(
      null
    );

    setHeadlessStatus(
      'Configuration changed. Run a new headless experiment.'
    );
  }


  function updateExperimentSeed(
    nextSeed: number
  ) {

    if (
      !Number.isFinite(
        nextSeed
      )
    ) {
      return;
    }


    const normalizedSeed =
      Math.min(
        0xFFFF_FFFF,
        Math.max(
          0,
          Math.trunc(
            nextSeed
          )
        )
      );


    setExperimentSeed(
      normalizedSeed
    );

    invalidateHeadlessResult();


    restartExperiment(
      vehicleCount,
      closedSegmentKeys,
      comparisonEnabled,
      normalizedSeed
    );
  }


  async function submitHeadlessExperiment() {

    if (
      !graph
      ||
      headlessRunning
    ) {
      return;
    }


    const requestToken =
      headlessRequestTokenRef.current
      + 1;

    headlessRequestTokenRef.current =
      requestToken;


    setHeadlessRunning(
      true
    );

    setHeadlessResult(
      null
    );

    setHeadlessStatus(
      'Running server-side experiment...'
    );


    try {

      const result =
        await runHeadlessExperiment({
          network:
            toRoadGraphDto(
              graph
            ),
          closedSegmentKeys,
          requestedVehicleCount:
            vehicleCount,
          seed:
            experimentSeed,
          comparisonEnabled,
          maxSimulationSeconds:
            1800,
        });


      if (
        requestToken
        !== headlessRequestTokenRef.current
      ) {
        return;
      }


      setHeadlessResult(
        result
      );

      setHeadlessStatus(
        result.completionReason
        === 'ALL_TRIPS_COMPLETED'
        ? 'Headless experiment completed.'
        : 'Headless experiment reached the simulation-duration limit.'
      );

    } catch (error) {

      console.error(
        error
      );

      if (
        requestToken
        !== headlessRequestTokenRef.current
      ) {
        return;
      }


      setHeadlessResult(
        null
      );

      setHeadlessStatus(
        error instanceof Error
        ? error.message
        : 'Headless experiment failed.'
      );

    } finally {

      setHeadlessRunning(
        false
      );
    }
  }


  function updateVehicleCount(
    nextCount: number
  ) {

    setVehicleCount(
      nextCount
    );

    invalidateHeadlessResult();


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

    invalidateHeadlessResult();


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

    invalidateHeadlessResult();


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

    invalidateHeadlessResult();


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


            <label className="control-label seed-control-label">

              <span>
                Deterministic seed
              </span>

            </label>


            <input
              className="numeric-control"
              type="number"
              min="0"
              max="4294967295"
              step="1"
              value={
                experimentSeed
              }
              onChange={
                event =>
                  updateExperimentSeed(
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
              HEADLESS EXPERIMENT
            </span>

            <p className="small-note left">
              Runs the current network and scenario on the
              server without map rendering or real-time pacing.
            </p>

            <button
              className="simulation-button headless-button"
              type="button"
              disabled={
                !graph
                ||
                headlessRunning
              }
              onClick={
                submitHeadlessExperiment
              }
            >
              {
                headlessRunning
                ? 'Running headless experiment...'
                : 'Run headless experiment'
              }
            </button>

            <p className="status headless-status">
              {headlessStatus}
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


          {
            headlessResult
            && (
              <>

                <span className="section-label headless-result-label">
                  HEADLESS RESULT
                </span>


                <Metric
                  label="Server throughput"
                  value={
                    headlessResult.scenarioMetrics
                    ? `${headlessResult.scenarioMetrics.throughputPerMinute.toFixed(1)}/min`
                    : '—'
                  }
                  emphasis
                />


                {
                  headlessResult.baselineMetrics
                  && (
                    <Metric
                      label="Server baseline throughput"
                      value={
                        `${headlessResult.baselineMetrics.throughputPerMinute.toFixed(1)}/min`
                      }
                    />
                  )
                }


                {
                  headlessResult.comparisonEnabled
                  && (
                    <Metric
                      label="Throughput delta"
                      value={
                        headlessResult.throughputDeltaPercent
                        === null
                        ? '—'
                        : `${headlessResult.throughputDeltaPercent >= 0 ? '+' : ''}`
                          + `${headlessResult.throughputDeltaPercent.toFixed(1)}%`
                      }
                    />
                  )
                }


                <Metric
                  label="Server completed trips"
                  value={
                    headlessResult.completedTrips
                    ?.toLocaleString()
                    ?? '—'
                  }
                />


                <Metric
                  label="Server simulated time"
                  value={
                    headlessResult.simulationDurationSeconds
                    === null
                    ? '—'
                    : `${Math.floor(headlessResult.simulationDurationSeconds)} s`
                  }
                />


                <Metric
                  label="Completion"
                  value={
                    headlessResult.completionReason
                    === 'ALL_TRIPS_COMPLETED'
                    ? 'All trips completed'
                    : 'Duration limit reached'
                  }
                />

              </>
            )
          }

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

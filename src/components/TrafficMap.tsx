import {
  useEffect,
  useRef,
  useState,
} from 'react';

import * as maplibregl
  from 'maplibre-gl';

import workerUrl
  from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';

import 'maplibre-gl/dist/maplibre-gl.css';

import type {
  RoadEdge,
  RoadGraph,
} from '../model/graph';

import type {
  RoadMetadataIndex,
} from '../application/roadMetadata';

import {
  getEdgePhysicalSegmentKey,
} from '../application/roadIdentity';

import type {
  RoadSelection,
  RoadSpeedView,
  VehicleView,
} from '../application/viewModels';


type TrafficMapProps = {
  latitude: number;
  longitude: number;

  graph:
    RoadGraph
    | null;

  roadMetadata:
    RoadMetadataIndex;

  vehicles:
    VehicleView[];

  roadSpeeds:
    RoadSpeedView[];

  selectedSegmentKey:
    string
    | null;

  closedSegmentKeys:
    string[];

  onRoadSelect: (
    road:
      RoadSelection
  ) => void;
};


const EMPTY_FEATURE_COLLECTION = {
  type:
    'FeatureCollection' as const,

  features: [],
};


/*
 * Color thresholds are deliberately presentation-only.
 *
 * They never feed back into IDM, routing, or timestep logic.
 */
const SLOW_SPEED_RATIO =
  0.70;

const VERY_SLOW_SPEED_RATIO =
  0.35;


export default function TrafficMap({
  latitude,
  longitude,
  graph,
  roadMetadata,
  vehicles,
  roadSpeeds,
  selectedSegmentKey,
  closedSegmentKeys,
  onRoadSelect,
}: TrafficMapProps) {

  const containerRef =
    useRef<
      HTMLDivElement
      | null
    >(
      null
    );

  const mapRef =
    useRef<
      maplibregl.Map
      | null
    >(
      null
    );

  const onRoadSelectRef =
    useRef(
      onRoadSelect
    );

  const previousSpeedKeysRef =
    useRef<
      Set<string>
    >(
      new Set()
    );

  const previousClosedKeysRef =
    useRef<
      Set<string>
    >(
      new Set()
    );

  const [
    mapReady,
    setMapReady,
  ] =
    useState(false);


  useEffect(() => {

    onRoadSelectRef.current =
      onRoadSelect;

  }, [onRoadSelect]);


  useEffect(() => {

    if (
      !containerRef.current
      ||
      mapRef.current
    ) {
      return;
    }


    const apiKey =
      import.meta.env
        .VITE_MAPTILER_API_KEY;


    if (!apiKey) {
      throw new Error(
        'VITE_MAPTILER_API_KEY is not configured.'
      );
    }


    maplibregl.setWorkerUrl(
      workerUrl
    );


    const map =
      new maplibregl.Map({
        container:
          containerRef.current,

        style:
          `https://api.maptiler.com/maps/streets-v4/style.json?key=${apiKey}`,

        center: [
          longitude,
          latitude,
        ],

        zoom:
          13,
      });


    map.addControl(
      new maplibregl
        .NavigationControl(),
      'bottom-right'
    );


    map.once(
      'load',
      () => {

        map.addSource(
          'simulation-roads',
          {
            type:
              'geojson',

            data:
              EMPTY_FEATURE_COLLECTION,
          }
        );


        map.addLayer({
          id:
            'simulation-road-speed-overlay',

          type:
            'line',

          source:
            'simulation-roads',

          paint: {
            'line-color': [
              'case',

              [
                'boolean',
                [
                  'feature-state',
                  'closed',
                ],
                false,
              ],

              '#7f1d1d',

              [
                'step',

                [
                  'coalesce',
                  [
                    'feature-state',
                    'speedRatio',
                  ],
                  1,
                ],

                '#ef4444',

                VERY_SLOW_SPEED_RATIO,
                '#f59e0b',

                SLOW_SPEED_RATIO,
                '#22c55e',
              ],
            ],

            'line-width':
              2.6,

            'line-opacity':
              0.84,
          },
        });


        map.addLayer({
          id:
            'selected-simulation-road',

          type:
            'line',

          source:
            'simulation-roads',

          filter: [
            '==',
            ['get', 'segmentKey'],
            '',
          ],

          paint: {
            'line-color':
              '#2563eb',

            'line-width':
              7,

            'line-opacity':
              0.95,
          },
        });


        map.addLayer({
          id:
            'simulation-road-hitbox',

          type:
            'line',

          source:
            'simulation-roads',

          paint: {
            'line-color':
              '#000000',

            'line-width':
              14,

            'line-opacity':
              0,
          },
        });


        map.addSource(
          'simulation-vehicles',
          {
            type:
              'geojson',

            data:
              EMPTY_FEATURE_COLLECTION,
          }
        );


        map.addLayer({
          id:
            'simulation-vehicles',

          type:
            'circle',

          source:
            'simulation-vehicles',

          paint: {
            'circle-radius': [
              'interpolate',
              ['linear'],
              ['zoom'],

              10,
              2.2,

              14,
              4.4,

              17,
              6.5,
            ],

            'circle-color': [
              'step',
              ['get', 'speedRatio'],

              '#ef4444',

              VERY_SLOW_SPEED_RATIO,
              '#f59e0b',

              SLOW_SPEED_RATIO,
              '#22c55e',
            ],

            'circle-stroke-color':
              '#ffffff',

            'circle-stroke-width':
              0.6,

            'circle-opacity':
              0.95,
          },
        });


        map.on(
          'click',
          'simulation-road-hitbox',
          event => {

            const feature =
              event.features?.[0];

            const properties =
              feature?.properties;

            if (!properties) {
              return;
            }

            const segmentKey =
              String(
                properties.segmentKey
                ?? ''
              );

            if (!segmentKey) {
              return;
            }


            onRoadSelectRef.current({
              segmentKey,

              displayName:
                String(
                  properties.displayName
                  ?? 'Unnamed road'
                ),

              speedLimitMps:
                Number(
                  properties.speedLimitMps
                  ?? 0
                ),
            });
          }
        );


        map.on(
          'mouseenter',
          'simulation-road-hitbox',
          () => {

            map
              .getCanvas()
              .style
              .cursor =
              'pointer';
          }
        );


        map.on(
          'mouseleave',
          'simulation-road-hitbox',
          () => {

            map
              .getCanvas()
              .style
              .cursor =
              '';
          }
        );


        setMapReady(
          true
        );
      }
    );


    mapRef.current =
      map;


    return () => {

      map.remove();

      mapRef.current =
        null;
    };

  }, []);


  useEffect(() => {

    const map =
      mapRef.current;

    if (
      !map
      ||
      !mapReady
    ) {
      return;
    }


    map.easeTo({
      center: [
        longitude,
        latitude,
      ],

      zoom:
        13,

      duration:
        600,
    });

  }, [
    latitude,
    longitude,
    mapReady,
  ]);


  /*
   * Graph -> GeoJSON happens only when the loaded network changes.
   *
   * The live road-speed overlay is applied through feature-state,
   * so we do not rebuild thousands of LineStrings every telemetry tick.
   */
  useEffect(() => {

    const map =
      mapRef.current;

    if (
      !map
      ||
      !mapReady
      ||
      !graph
    ) {
      return;
    }


    const physicalSegments =
      new Map<
        string,
        RoadEdge
      >();


    for (
      const outgoingEdges
      of graph.adjacency.values()
    ) {

      for (
        const edge
        of outgoingEdges
      ) {

        const segmentKey =
          getEdgePhysicalSegmentKey(
            edge
          );

        if (
          !physicalSegments.has(
            segmentKey
          )
        ) {

          physicalSegments.set(
            segmentKey,
            edge
          );
        }
      }
    }


    const features =
      Array.from(
        physicalSegments,
        (
          [
            segmentKey,
            edge,
          ]
        ) => {

          const fromNode =
            graph.nodes.get(
              edge.from
            )!;

          const toNode =
            graph.nodes.get(
              edge.to
            )!;

          const displayName =
            roadMetadata.get(
              segmentKey
            )?.displayName
            ??
            'Unnamed road';


          return {
            type:
              'Feature' as const,

            id:
              segmentKey,

            properties: {
              segmentKey,

              displayName,

              speedLimitMps:
                edge.speedLimitMps,
            },

            geometry: {
              type:
                'LineString' as const,

              coordinates: [
                [
                  fromNode.longitude,
                  fromNode.latitude,
                ],
                [
                  toNode.longitude,
                  toNode.latitude,
                ],
              ],
            },
          };
        }
      );


    const source =
      map.getSource(
        'simulation-roads'
      ) as
        | maplibregl.GeoJSONSource
        | undefined;


    source?.setData({
      type:
        'FeatureCollection',

      features,
    });


    previousSpeedKeysRef.current =
      new Set();

    previousClosedKeysRef.current =
      new Set();

  }, [
    graph,
    roadMetadata,
    mapReady,
  ]);


  useEffect(() => {

    const map =
      mapRef.current;

    if (
      !map
      ||
      !mapReady
      ||
      !graph
    ) {
      return;
    }


    const currentKeys =
      new Set(
        roadSpeeds.map(
          road =>
            road.segmentKey
        )
      );


    /*
     * Segments that were occupied during the previous telemetry
     * update but are empty now return to free-flow display.
     */
    for (
      const segmentKey
      of previousSpeedKeysRef.current
    ) {

      if (
        !currentKeys.has(
          segmentKey
        )
      ) {

        map.setFeatureState(
          {
            source:
              'simulation-roads',

            id:
              segmentKey,
          },
          {
            speedRatio:
              1,
          }
        );
      }
    }


    for (
      const road
      of roadSpeeds
    ) {

      map.setFeatureState(
        {
          source:
            'simulation-roads',

          id:
            road.segmentKey,
        },
        {
          speedRatio:
            road.averageSpeedRatio,
        }
      );
    }


    previousSpeedKeysRef.current =
      currentKeys;

  }, [
    roadSpeeds,
    graph,
    mapReady,
  ]);


  useEffect(() => {

    const map =
      mapRef.current;

    if (
      !map
      ||
      !mapReady
      ||
      !graph
    ) {
      return;
    }


    const currentClosed =
      new Set(
        closedSegmentKeys
      );


    for (
      const segmentKey
      of previousClosedKeysRef.current
    ) {

      if (
        !currentClosed.has(
          segmentKey
        )
      ) {

        map.setFeatureState(
          {
            source:
              'simulation-roads',

            id:
              segmentKey,
          },
          {
            closed:
              false,
          }
        );
      }
    }


    for (
      const segmentKey
      of currentClosed
    ) {

      map.setFeatureState(
        {
          source:
            'simulation-roads',

          id:
            segmentKey,
        },
        {
          closed:
            true,
        }
      );
    }


    previousClosedKeysRef.current =
      currentClosed;

  }, [
    closedSegmentKeys,
    graph,
    mapReady,
  ]);


  useEffect(() => {

    const map =
      mapRef.current;

    if (
      !map
      ||
      !mapReady
    ) {
      return;
    }


    const source =
      map.getSource(
        'simulation-vehicles'
      ) as
        | maplibregl.GeoJSONSource
        | undefined;


    source?.setData({
      type:
        'FeatureCollection',

      features:
        vehicles.map(
          vehicle => ({
            type:
              'Feature' as const,

            id:
              vehicle.id,

            properties: {
              speedRatio:
                vehicle.speedRatio,
            },

            geometry: {
              type:
                'Point' as const,

              coordinates: [
                vehicle.longitude,
                vehicle.latitude,
              ],
            },
          })
        ),
    });

  }, [
    vehicles,
    mapReady,
  ]);


  useEffect(() => {

    const map =
      mapRef.current;

    if (
      !map
      ||
      !mapReady
      ||
      !map.getLayer(
        'selected-simulation-road'
      )
    ) {
      return;
    }


    map.setFilter(
      'selected-simulation-road',
      [
        '==',
        ['get', 'segmentKey'],
        selectedSegmentKey
        ?? '',
      ]
    );

  }, [
    selectedSegmentKey,
    mapReady,
  ]);


  return (
    <div
      ref={containerRef}
      className="traffic-map"
    />
  );
}

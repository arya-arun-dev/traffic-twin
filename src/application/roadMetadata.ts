import type {
  OsmResponse,
} from '../data/osm';

import {
  getPhysicalSegmentKey,
} from './roadIdentity';


export type RoadDisplayMetadata = {
  displayName: string;
};

export type RoadMetadataIndex =
  Map<
    string,
    RoadDisplayMetadata
  >;


/*
 * Builds UI metadata directly from the OSM response.
 *
 * Road names do not belong in RoadEdge because routing, IDM,
 * and timestep computation do not require them.
 *
 * The map can therefore display "Congress Avenue" without
 * polluting the simulation graph with presentation metadata.
 */
export function buildRoadMetadataIndex(
  osm: OsmResponse
): RoadMetadataIndex {

  const metadata:
    RoadMetadataIndex =
    new Map();


  for (
    const element
    of osm.elements
  ) {

    if (
      element.type !== 'way'
    ) {
      continue;
    }

    const displayName =
      element.tags?.name
      ??
      element.tags?.ref;

    if (!displayName) {
      continue;
    }


    for (
      let i = 0;
      i < element.nodes.length - 1;
      i++
    ) {

      const key =
        getPhysicalSegmentKey(
          element.nodes[i],
          element.nodes[i + 1]
        );

      /*
       * If more than one OSM way happens to describe the same
       * node pair, retain the first useful display name.
       *
       * This metadata has no effect on simulation behavior.
       */
      if (
        !metadata.has(
          key
        )
      ) {

        metadata.set(
          key,
          {
            displayName,
          }
        );
      }
    }
  }


  return metadata;
}

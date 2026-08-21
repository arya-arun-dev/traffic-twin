import {
  fetchRoadNetwork,
} from './osm';

import type {
  OsmResponse,
} from './osm';


/*
 * The canonical osm.ts remains unchanged.
 *
 * This small application-side cache solves the React development
 * StrictMode double-mount problem without pushing React concerns
 * into the OSM adapter. Two simultaneous requests for the same
 * location/radius share one Promise.
 */
const requestCache =
  new Map<
    string,
    Promise<OsmResponse>
  >();


export function loadRoadNetwork(
  latitude: number,
  longitude: number,
  radiusMeters: number
): Promise<OsmResponse> {

  const key =
    `${latitude.toFixed(6)},`
    + `${longitude.toFixed(6)},`
    + `${radiusMeters}`;

  const existing =
    requestCache.get(
      key
    );

  if (existing) {
    return existing;
  }


  const request =
    fetchRoadNetwork(
      latitude,
      longitude,
      radiusMeters
    );


  requestCache.set(
    key,
    request
  );


  request.catch(
    () => {

      /*
       * A failed Overpass response must not become a permanent
       * cached failure. The next load is allowed to retry.
       */
      if (
        requestCache.get(
          key
        )
        === request
      ) {

        requestCache.delete(
          key
        );
      }
    }
  );


  return request;
}

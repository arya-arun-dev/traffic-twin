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


  const request = (async (): Promise<OsmResponse> => {
    const isDefaultAustin =
      latitude.toFixed(6) === '30.267200' &&
      longitude.toFixed(6) === '-97.743100' &&
      radiusMeters === 1500;

    if (isDefaultAustin) {
      try {
        const response = await fetch(
          `${import.meta.env.BASE_URL}data/austin-roads.json`,
          { signal: AbortSignal.timeout(5000) }
        );

        if (!response.ok) {
          throw new Error(`Snapshot request failed: ${response.status}`);
        }

        const data = await response.json() as OsmResponse;

        if (
          !Array.isArray(data.elements) ||
          !data.elements.some(element => element.type === 'node') ||
          !data.elements.some(element => element.type === 'way')
        ) {
          throw new Error('Invalid Austin snapshot.');
        }

        return data;
      } catch (error) {
        console.warn(
          'Austin snapshot unavailable; trying Overpass.',
          error
        );
      }
    }

    return fetchRoadNetwork(
      latitude,
      longitude,
      radiusMeters
    );
  })();


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

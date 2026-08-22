const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];


export type OsmNodeElement = {
  type: 'node';
  id: number;
  lat: number;
  lon: number;
};

export type OsmWayElement = {
  type: 'way';
  id: number;
  nodes: number[];
  tags?: Record<string, string>;
};

export type OsmElement =
  | OsmNodeElement
  | OsmWayElement;

export type OsmResponse = {
  elements: OsmElement[];
};


export async function fetchRoadNetwork(
  latitude: number,
  longitude: number,
  radiusMeters: number
): Promise<OsmResponse> {

  /*
   * OSM uses "highway" for roads.
   *
   * Restrict the query to road types
   * relevant to motor-vehicle traffic.
   */
  const highwayTypes =
    'motorway'
    + '|motorway_link'
    + '|trunk'
    + '|trunk_link'
    + '|primary'
    + '|primary_link'
    + '|secondary'
    + '|secondary_link'
    + '|tertiary'
    + '|tertiary_link'
    + '|unclassified'
    + '|residential'
    + '|living_street';


  /*
   * First return the ways with their tags
   * and node references.
   *
   * Then fetch the referenced nodes.
   *
   * For those node elements we only need
   * their IDs and coordinates, so skeleton
   * output is sufficient.
   */
  const query = `
    [out:json][timeout:25];

    way
    (around:${radiusMeters},${latitude},${longitude})
    ["highway"~"${highwayTypes}"];

    out body;

    >;

    out skel qt;
  `;


  let lastError:
    unknown =
    null;


  /*
   * Public Overpass instances can occasionally
   * be overloaded.
   *
   * Try the configured endpoints in order.
   *
   * This affects only acquisition of the OSM
   * input data. It has no effect on the
   * deterministic simulation once the graph
   * has been constructed.
   */
  for (
    const endpoint
    of OVERPASS_ENDPOINTS
  ) {

    try {

      const response =
        await fetch(
          endpoint,
          {
            method: 'POST',

            headers: {
              'Content-Type':
                'application/x-www-form-urlencoded',
            },

            body:
              'data='
              + encodeURIComponent(
                  query
                ),
          }
        );


      if (!response.ok) {

        lastError =
          new Error(
            `Overpass request failed: `
            + `${response.status} `
            + `(${endpoint})`
          );

        /*
         * A 429 or server-side 5xx error may
         * simply mean this public instance is
         * busy, so try the next instance.
         */
        if (
          response.status === 429
          ||
          response.status >= 500
        ) {
          continue;
        }


        throw lastError;
      }

      const data = (await response.json()) as OsmResponse;

      return data;

    } catch (error) {

      lastError =
        error;

      console.warn(
        `Overpass endpoint failed:`,
        endpoint,
        error
      );
    }
  }


  throw new Error(
    'All configured Overpass endpoints failed.',
    {
      cause:
        lastError,
    }
  );
}
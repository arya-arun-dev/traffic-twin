const MAPTILER_GEOCODING_ENDPOINT =
  'https://api.maptiler.com/geocoding';


export type LocationResult = {
  id: string;
  displayName: string;
  latitude: number;
  longitude: number;
  placeType: string;
};


type MapTilerFeature = {
  id?: string;
  text?: string;
  place_name?: string;
  place_type?: string[];
  center?: [number, number];

  geometry?: {
    coordinates?: [number, number];
  };

  properties?: {
    name?: string;
    full_address?: string;
  };
};


type MapTilerGeocodingResponse = {
  features?: MapTilerFeature[];
};


function getMapTilerApiKey():
  string {

  const apiKey =
    import.meta.env
      .VITE_MAPTILER_API_KEY;

  if (!apiKey) {
    throw new Error(
      'VITE_MAPTILER_API_KEY is not configured.'
    );
  }

  return apiKey;
}


function toLocationResult(
  feature: MapTilerFeature
): LocationResult | null {

  const coordinates =
    feature.center
    ??
    feature.geometry
      ?.coordinates;

  if (
    !coordinates
    ||
    coordinates.length < 2
  ) {
    return null;
  }

  const [
    longitude,
    latitude,
  ] = coordinates;

  if (
    !Number.isFinite(longitude)
    ||
    !Number.isFinite(latitude)
  ) {
    return null;
  }

  const displayName =
    feature.place_name
    ??
    feature.properties
      ?.full_address
    ??
    feature.properties
      ?.name
    ??
    feature.text
    ??
    `${latitude}, ${longitude}`;


  return {
    id:
      feature.id
      ??
      `${longitude},${latitude}`,

    displayName,

    latitude,

    longitude,

    placeType:
      feature.place_type?.[0]
      ??
      'location',
  };
}


export async function searchLocationSuggestions(
  query: string,
  signal?: AbortSignal
): Promise<LocationResult[]> {

  const trimmed =
    query.trim();

  if (
    trimmed.length < 3
  ) {
    return [];
  }

  const apiKey =
    getMapTilerApiKey();

  const url =
    `${MAPTILER_GEOCODING_ENDPOINT}/`
    + `${encodeURIComponent(trimmed)}.json`
    + `?key=${encodeURIComponent(apiKey)}`
    + '&limit=6'
    + '&autocomplete=true';

  const response =
    await fetch(
      url,
      {
        signal,
      }
    );

  if (!response.ok) {
    throw new Error(
      `MapTiler geocoding failed: ${response.status}`
    );
  }

  const data:
    MapTilerGeocodingResponse =
    await response.json();

  const results:
    LocationResult[] =
    [];


  for (
    const feature
    of data.features ?? []
  ) {

    const location =
      toLocationResult(
        feature
      );

    if (location) {
      results.push(
        location
      );
    }
  }


  return results;
}


export async function searchLocation(
  query: string
): Promise<LocationResult> {

  const results =
    await searchLocationSuggestions(
      query
    );

  if (
    results.length === 0
  ) {
    throw new Error(
      `No location found for "${query}".`
    );
  }

  return results[0];
}

import { mkdir, writeFile } from 'node:fs/promises';
import { fetchRoadNetwork } from '../src/data/osm.ts';

const data = await fetchRoadNetwork(
  30.2672,
  -97.7431,
  1500
);

if (
  data.remark ||
  !Array.isArray(data.elements) ||
  !data.elements.some(element => element.type === 'node') ||
  !data.elements.some(element => element.type === 'way')
) {
  throw new Error('Austin road snapshot is incomplete.');
}

await mkdir('public/data', { recursive: true });

await writeFile(
  'public/data/austin-roads.json',
  JSON.stringify({ elements: data.elements })
);

console.log('Saved Austin road snapshot.');

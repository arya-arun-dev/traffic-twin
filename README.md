# Traffic Twin

**Traffic Twin** is a client-side digital twin simulation engine and visualization system designed to model multi-agent urban traffic flow, path routing, driver behavior, and scenario experiments directly in the browser.

---

## Technical Overview & System Architecture

The application is structured into decoupled domain models, data ingestion, scenario management, and UI visualization components.

src/
├── model/                  # Physics & Agent Core Engine
│   ├── graph.ts            # Road network graph (nodes, edges, geometry)
│   ├── idm.ts              # Intelligent Driver Model car-following math
│   ├── routing.ts          # Pathfinding algorithms (A*, Dijkstra)
│   ├── simulation.ts       # Time-step engine & multi-agent updates
│   └── types.ts            # Shared domain type definitions
├── data/                   # Network Ingestion & Geocoding
│   ├── osm.ts              # OpenStreetMap Overpass API client & parser
│   ├── geocoding.ts        # Nominatim location/coordinate lookup
│   └── roadNetworkLoader.ts# Raw OSM to graph representation converter
├── application/            # ViewModels & Application Logic
│   ├── roadIdentity.ts     # Edge/junction identification & hashing
│   ├── roadMetadata.ts     # Way tagging, speed limits, lane extraction
│   └── viewModels.ts       # UI state projection adapters
├── scenario/               # Traffic Interventions & Experiments
│   ├── ScenarioExperiment.ts # Comparative simulation lifecycle manager
│   └── interventions.ts    # Road closure, signal, & capacity modifiers
└── components/             # Rendering
└── TrafficMap.tsx      # Map Canvas/Leaflet vehicle & network renderer

---

## Core Features & Simulation Models

* **Intelligent Driver Model (IDM):** Implements microscopic longitudinal car-following dynamics to compute agent acceleration based on desired velocity, safe distance, and relative headways.
* **OSM Network Ingestion:** Fetches real-world street maps on demand via OpenStreetMap (Overpass API) and constructs directed graph representations with lane metadata.
* **Dynamic Routing Engine:** Computes optimal paths across edge weight topologies with live re-routing support under network perturbations.
* **Scenario & Intervention Engine:** Allows side-by-side traffic experimentation (e.g., lane closures, speed limit adjustments, traffic signal timing changes).
* **Real-time Map Rendering:** Interactive MapTiler mapping interface for visualizing multi-agent movements and edge congestion metrics.

---

## Tech Stack

* **Language:** TypeScript[cite: 1]
* **Build Tooling & Dev Server:** Vite[cite: 1]
* **UI Framework:** React[cite: 1]
* **Linting & Code Quality:** Oxlint (`.oxlintrc.json`)[cite: 1]
* **Type Checking:** `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`[cite: 1]

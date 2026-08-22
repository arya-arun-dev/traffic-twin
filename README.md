# Traffic Twin

**Traffic Twin** is a full-stack digital twin traffic simulation engine and visualization system modeling multi-agent traffic flow, path routing, driver behavior, and scenario experiments directly in the browser and via distributed backend services.

**Live Demo:** [diligent-fascination-production-e858.up.railway.app](https://diligent-fascination-production-e858.up.railway.app)

---

## Technical Architecture

The platform uses a distributed microservices architecture, separating frontend rendering, background Web Worker math execution, headless simulation services, and an orchestrating backend API.

<img width="594" height="862" alt="image" src="https://github.com/user-attachments/assets/e5ed2115-3b5b-4ad4-8572-4a2b3b8fe342" />


### Module Breakdown

* **`src/worker/` & `src/model/` (Client Engine):** Executes microscopic Intelligent Driver Model (IDM) physics, car-following calculations, and $A^*$/Dijkstra graph pathfinding off the UI thread via Web Workers (`simulation.worker.ts`).
* **`backend/spring-api/` (API Orchestrator):** A Java Spring Boot service managing experiment lifecycle, scenario metrics, PostgreSQL/H2 persistence, and client-facing REST endpoints.
* **`services/simulation-service/` (Headless Engine):** An isolated TypeScript/Node.js service for running batch traffic experiments, scenario evaluations, and server-side metrics calculations out-of-band.
* **`src/components/` & `src/application/` (UI Layer):** Converts raw spatial edge occupancy maps into latitude/longitude vectors (`viewModels.ts`) and paints vehicle movements onto an HTML5 Canvas/Leaflet map (`TrafficMap.tsx`).

---

## Core Features & Simulation Physics

* **Intelligent Driver Model (IDM):** Calculates real-time acceleration, velocity, and safe headway gap distributions for dynamic multi-agent flows.
* **Off-Main-Thread Execution:** Web Worker worker threads prevent UI frame drops and maintain 60 FPS Canvas rendering during high agent counts.
* **Dynamic OpenStreetMap Network Ingestion:** Fetches real-world road geometries on demand via OpenStreetMap's Overpass API and parses lane counts, turn directions, and max speed metadata.
* **Traffic Intervention Experiments:** Simulates lane closures, capacity adjustments, and speed limit overrides with dynamic route recalculation.
* **Headless Batch Analysis:** Supports server-side scenario execution to generate benchmark metrics (average travel times, bottleneck delays) without client rendering overhead.

---

## Tech Stack

### Frontend & Client Engine
* **Language/Framework:** TypeScript, React, Vite
* **Concurrency:** Web Workers (`simulation.worker.ts`)
* **Rendering & Visualization:** Leaflet, HTML5 Canvas Context

### Backend Services & Storage
* **API Gateway Service:** Java 17+, Spring Boot, Spring Data JPA
* **Simulation Service:** Node.js, TypeScript, Express
* **Database:** PostgreSQL / H2 Embedded Database (`schema.sql`)
* **Containerization & Deployment:** Docker, Docker Compose, Nginx, Railway

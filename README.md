# Traffic Twin

**Traffic Twin** is a full-stack traffic simulation and visualization platform designed to model vehicle movement, path routing, driver behavior, and intervention experiments on real-world road networks. It supports both interactive browser execution and server-side headless experiments.

**Live Demo:** [traffictwin.up.railway.app](https://traffictwin.up.railway.app/)

---

## Technical Architecture

The platform uses a multi-service full-stack architecture that separates frontend rendering, browser Web Worker execution, server-side simulation, backend orchestration, and experiment persistence.

### Module Breakdown

* **`src/worker/`, `src/model/` & `src/scenario/` (Simulation Core & Interactive Execution):** Implements microscopic Intelligent Driver Model (IDM) vehicle dynamics, A* graph routing, same-edge spacing, junction request/admission handling, deterministic seeded demand, and road-closure experiments. Interactive simulation runs in a Web Worker to keep simulation computation off the browser main thread.
* **`backend/spring-api/` (Application API):** A Java 21 Spring Boot service responsible for experiment validation, orchestration, PostgreSQL persistence, failure handling, and client-facing REST endpoints.
* **`services/simulation-service/` (Headless Compute Service):** A Node.js/TypeScript/Fastify service that reconstructs transported road graphs and executes the existing `ScenarioExperiment` implementation headlessly without rendering or real-time pacing.
* **`src/application/` & frontend UI (Presentation Layer):** Converts simulation state into view models and renders live vehicle movement and road-network state using React, MapLibre, and MapTiler.

---

## Core Features & Simulation Physics

* **Intelligent Driver Model (IDM):** Calculates microscopic vehicle acceleration based on desired speed, current speed, relative velocity, minimum spacing, and time-headway behavior.
* **Off-Main-Thread Execution:** Browser simulations execute in a Web Worker so microscopic simulation work does not block the React/UI thread.
* **Dynamic OpenStreetMap Network Ingestion:** Fetches real-world road geometries on demand through the OpenStreetMap Overpass API and constructs a directed road graph containing road geometry, segment length, speed limits, and lane metadata.
- **A\* Routing:** Computes free-flow vehicle routes across the directed road graph using travel-time edge costs.
* **Traffic Intervention Experiments:** Supports road-closure scenarios with deterministic baseline/scenario comparison.
* **Explicit Junction Handling:** Vehicles request admission when transitioning between road segments, with downstream entry-safety checks applied before junction movement.
* **Headless Experiment Execution:** Runs server-side simulations without map rendering or wall-clock pacing, allowing the fixed simulation timestep to execute as quickly as server CPU permits.
* **Experiment Metrics:** Captures throughput, completed trips, simulated duration, baseline/scenario results, and throughput percentage change.

---

## Tech Stack

### Frontend & Client Engine

* **Language / Framework:** TypeScript, React, Vite
* **Concurrency:** Web Workers (`simulation.worker.ts`)
* **Rendering & Visualization:** MapLibre GL, MapTiler

### Backend Services & Storage

* **Application API:** Java 21, Spring Boot, Spring Web, Spring Validation, Spring Data JPA
* **Simulation Service:** Node.js 24, TypeScript, Fastify, Zod
* **Database:** PostgreSQL
* **Build Tooling:** Maven, npm, esbuild
* **Containerization & Deployment:** Docker, Docker Compose, Nginx, Railway

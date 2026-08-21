# TrafficTwin

**Urban Traffic Digital Twin & Intervention Simulator**

TrafficTwin is a browser-based microscopic traffic simulation platform for exploring how changes to a real road network affect vehicle movement and network throughput.

The application loads real roads and intersections from OpenStreetMap, converts them into a directed road graph, assigns routes with A*, and simulates individual vehicle motion using the Intelligent Driver Model (IDM). Users can interact with the network through a map interface, close road segments, compare an intervention against a baseline scenario, and observe the resulting traffic behavior.

TrafficTwin is intentionally built around a **first-principles simulation core** rather than around the visualization layer. The traffic model can operate independently of React, MapLibre, or any browser-specific functionality.

> **Current model status:** Road geometry is based on real OpenStreetMap data, but traffic demand is synthetic. TrafficTwin should therefore be treated as a simulation and experimentation platform rather than a calibrated representation of current real-world traffic conditions.

---

## Overview

TrafficTwin models traffic at the individual-vehicle level.

At a high level:

```text
OpenStreetMap
      │
      ▼
Directed Road Graph
      │
      ▼
Synthetic Origin / Destination Demand
      │
      ▼
A* Route Assignment
      │
      ▼
Microscopic Vehicle Simulation
      │
      ├── Intelligent Driver Model
      ├── Hard vehicle spacing
      ├── Junction movement requests
      ├── Junction permissions
      └── Downstream entry safety
      │
      ▼
Scenario Metrics
      │
      ▼
Application Projection
      │
      ▼
React + MapLibre Visualization

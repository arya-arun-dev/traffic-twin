package com.traffictwin.api.dto;

public record SimulationServiceResponse(
        int initialVehicleCount,
        ScenarioMetricsDto scenarioMetrics,
        ScenarioMetricsDto baselineMetrics,
        Double throughputDeltaPercent,
        double simulationDurationSeconds,
        int completedTrips,
        String completionReason
) {
}

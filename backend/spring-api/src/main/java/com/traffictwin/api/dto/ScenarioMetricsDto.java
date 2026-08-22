package com.traffictwin.api.dto;

public record ScenarioMetricsDto(
        int activeVehicles,
        double throughputPerMinute,
        int completedTrips,
        double simulationTimeSeconds
) {
}

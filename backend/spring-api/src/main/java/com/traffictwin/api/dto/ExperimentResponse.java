package com.traffictwin.api.dto;

import com.traffictwin.api.entity.ExperimentStatus;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record ExperimentResponse(
        UUID id,
        Instant createdAt,
        Instant completedAt,
        ExperimentStatus status,
        int requestedVehicleCount,
        Integer initialVehicleCount,
        long seed,
        boolean comparisonEnabled,
        List<String> closedSegmentKeys,
        ScenarioMetricsDto scenarioMetrics,
        ScenarioMetricsDto baselineMetrics,
        Double throughputDeltaPercent,
        Double simulationDurationSeconds,
        Integer completedTrips,
        String completionReason,
        String failureMessage
) {
}

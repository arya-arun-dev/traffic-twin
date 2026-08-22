package com.traffictwin.api.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;

import java.util.List;

public record ExperimentRequest(
        @NotNull @Valid RoadGraphDto network,
        List<@Pattern(regexp = "^\\d+-\\d+$") String> closedSegmentKeys,
        @Min(1) @Max(100000) int requestedVehicleCount,
        @Min(0) @Max(4294967295L) long seed,
        boolean comparisonEnabled,
        @Positive @DecimalMax("86400") Double maxSimulationSeconds
) {

    public List<String> normalizedClosedSegmentKeys() {
        return closedSegmentKeys == null ? List.of() : List.copyOf(closedSegmentKeys);
    }

    public double normalizedMaxSimulationSeconds() {
        return maxSimulationSeconds == null ? 1800.0 : maxSimulationSeconds;
    }
}

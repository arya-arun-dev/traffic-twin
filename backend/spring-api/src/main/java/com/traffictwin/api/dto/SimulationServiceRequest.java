package com.traffictwin.api.dto;

import java.util.List;

public record SimulationServiceRequest(
        RoadGraphDto network,
        List<String> closedSegmentKeys,
        int requestedVehicleCount,
        long seed,
        boolean comparisonEnabled,
        double maxSimulationSeconds
) {
    public static SimulationServiceRequest from(ExperimentRequest request) {
        return new SimulationServiceRequest(
                request.network(),
                request.normalizedClosedSegmentKeys(),
                request.requestedVehicleCount(),
                request.seed(),
                request.comparisonEnabled(),
                request.normalizedMaxSimulationSeconds()
        );
    }
}

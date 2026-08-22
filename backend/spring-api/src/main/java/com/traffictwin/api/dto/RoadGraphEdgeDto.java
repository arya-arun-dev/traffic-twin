package com.traffictwin.api.dto;

import jakarta.validation.constraints.Positive;

public record RoadGraphEdgeDto(
        long from,
        long to,
        @Positive double lengthMeters,
        @Positive double speedLimitMps
) {
}

package com.traffictwin.api.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

import java.util.List;

public record RoadGraphDto(
        @NotEmpty @Size(min = 2) List<@Valid RoadGraphNodeDto> nodes,
        @NotEmpty List<@Valid RoadGraphEdgeDto> edges
) {
}

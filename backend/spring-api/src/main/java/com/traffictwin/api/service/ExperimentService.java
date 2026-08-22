package com.traffictwin.api.service;

import com.traffictwin.api.dto.ExperimentRequest;
import com.traffictwin.api.dto.ExperimentResponse;
import com.traffictwin.api.dto.ScenarioMetricsDto;
import com.traffictwin.api.dto.SimulationServiceRequest;
import com.traffictwin.api.dto.SimulationServiceResponse;
import com.traffictwin.api.entity.Experiment;
import com.traffictwin.api.exception.ExperimentExecutionException;
import com.traffictwin.api.exception.ExperimentNotFoundException;
import com.traffictwin.api.repository.ExperimentRepository;
import org.springframework.stereotype.Service;

import java.util.Arrays;
import java.util.List;
import java.util.UUID;

@Service
public class ExperimentService {

    private final ExperimentRepository repository;
    private final SimulationServiceClient simulationServiceClient;

    public ExperimentService(
            ExperimentRepository repository,
            SimulationServiceClient simulationServiceClient
    ) {
        this.repository = repository;
        this.simulationServiceClient = simulationServiceClient;
    }

    public ExperimentResponse runExperiment(ExperimentRequest request) {
        Experiment experiment = Experiment.running(
                request.requestedVehicleCount(),
                request.seed(),
                request.comparisonEnabled(),
                serializeClosures(request.normalizedClosedSegmentKeys())
        );

        repository.save(experiment);

        try {
            SimulationServiceResponse simulationResult =
                    simulationServiceClient.run(SimulationServiceRequest.from(request));

            experiment.complete(
                    simulationResult.initialVehicleCount(),
                    simulationResult.scenarioMetrics(),
                    simulationResult.baselineMetrics(),
                    simulationResult.throughputDeltaPercent(),
                    simulationResult.simulationDurationSeconds(),
                    simulationResult.completionReason()
            );

            repository.save(experiment);
            return toResponse(experiment);

        } catch (RuntimeException exception) {
            String message = exception.getMessage() == null
                    ? "Headless simulation failed."
                    : exception.getMessage();

            experiment.fail(message);
            repository.save(experiment);

            throw new ExperimentExecutionException(
                    experiment.getId(),
                    "Headless experiment execution failed.",
                    exception
            );
        }
    }

    public ExperimentResponse getExperiment(UUID id) {
        return repository.findById(id)
                .map(this::toResponse)
                .orElseThrow(() -> new ExperimentNotFoundException(id));
    }

    public List<ExperimentResponse> listExperiments() {
        return repository.findAllByOrderByCreatedAtDesc()
                .stream()
                .map(this::toResponse)
                .toList();
    }

    private ExperimentResponse toResponse(Experiment experiment) {
        ScenarioMetricsDto scenarioMetrics = scenarioMetrics(experiment);
        ScenarioMetricsDto baselineMetrics = baselineMetrics(experiment);

        return new ExperimentResponse(
                experiment.getId(),
                experiment.getCreatedAt(),
                experiment.getCompletedAt(),
                experiment.getStatus(),
                experiment.getRequestedVehicleCount(),
                experiment.getInitialVehicleCount(),
                experiment.getSeed(),
                experiment.isComparisonEnabled(),
                deserializeClosures(experiment.getClosureConfig()),
                scenarioMetrics,
                baselineMetrics,
                experiment.getThroughputDeltaPercent(),
                experiment.getSimulationDurationSeconds(),
                scenarioMetrics == null ? null : scenarioMetrics.completedTrips(),
                experiment.getCompletionReason(),
                experiment.getFailureMessage()
        );
    }

    private ScenarioMetricsDto scenarioMetrics(Experiment experiment) {
        if (experiment.getScenarioActiveVehicles() == null) {
            return null;
        }

        return new ScenarioMetricsDto(
                experiment.getScenarioActiveVehicles(),
                experiment.getScenarioThroughputPerMinute(),
                experiment.getScenarioCompletedTrips(),
                experiment.getScenarioSimulationTimeSeconds()
        );
    }

    private ScenarioMetricsDto baselineMetrics(Experiment experiment) {
        if (experiment.getBaselineActiveVehicles() == null) {
            return null;
        }

        return new ScenarioMetricsDto(
                experiment.getBaselineActiveVehicles(),
                experiment.getBaselineThroughputPerMinute(),
                experiment.getBaselineCompletedTrips(),
                experiment.getBaselineSimulationTimeSeconds()
        );
    }

    private String serializeClosures(List<String> closures) {
        return String.join(",", closures);
    }

    private List<String> deserializeClosures(String closureConfig) {
        if (closureConfig == null || closureConfig.isBlank()) {
            return List.of();
        }

        return Arrays.asList(closureConfig.split(","));
    }
}

package com.traffictwin.api.entity;

import com.traffictwin.api.dto.ScenarioMetricsDto;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "experiments")
public class Experiment {

    @Id
    private UUID id;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    private Instant completedAt;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ExperimentStatus status;

    @Column(nullable = false)
    private int requestedVehicleCount;

    private Integer initialVehicleCount;

    @Column(nullable = false)
    private long seed;

    @Column(nullable = false)
    private boolean comparisonEnabled;

    @Column(nullable = false, columnDefinition = "text")
    private String closureConfig;

    private Integer scenarioActiveVehicles;
    private Double scenarioThroughputPerMinute;
    private Integer scenarioCompletedTrips;
    private Double scenarioSimulationTimeSeconds;

    private Integer baselineActiveVehicles;
    private Double baselineThroughputPerMinute;
    private Integer baselineCompletedTrips;
    private Double baselineSimulationTimeSeconds;

    private Double throughputDeltaPercent;
    private Double simulationDurationSeconds;

    @Column(length = 64)
    private String completionReason;

    @Column(columnDefinition = "text")
    private String failureMessage;

    protected Experiment() {
    }

    public static Experiment running(
            int requestedVehicleCount,
            long seed,
            boolean comparisonEnabled,
            String closureConfig
    ) {
        Experiment experiment = new Experiment();
        experiment.id = UUID.randomUUID();
        experiment.createdAt = Instant.now();
        experiment.status = ExperimentStatus.RUNNING;
        experiment.requestedVehicleCount = requestedVehicleCount;
        experiment.seed = seed;
        experiment.comparisonEnabled = comparisonEnabled;
        experiment.closureConfig = closureConfig;
        return experiment;
    }

    public void complete(
            int initialVehicleCount,
            ScenarioMetricsDto scenarioMetrics,
            ScenarioMetricsDto baselineMetrics,
            Double throughputDeltaPercent,
            double simulationDurationSeconds,
            String completionReason
    ) {
        this.status = ExperimentStatus.COMPLETED;
        this.completedAt = Instant.now();
        this.initialVehicleCount = initialVehicleCount;

        this.scenarioActiveVehicles = scenarioMetrics.activeVehicles();
        this.scenarioThroughputPerMinute = scenarioMetrics.throughputPerMinute();
        this.scenarioCompletedTrips = scenarioMetrics.completedTrips();
        this.scenarioSimulationTimeSeconds = scenarioMetrics.simulationTimeSeconds();

        if (baselineMetrics != null) {
            this.baselineActiveVehicles = baselineMetrics.activeVehicles();
            this.baselineThroughputPerMinute = baselineMetrics.throughputPerMinute();
            this.baselineCompletedTrips = baselineMetrics.completedTrips();
            this.baselineSimulationTimeSeconds = baselineMetrics.simulationTimeSeconds();
        }

        this.throughputDeltaPercent = throughputDeltaPercent;
        this.simulationDurationSeconds = simulationDurationSeconds;
        this.completionReason = completionReason;
        this.failureMessage = null;
    }

    public void fail(String failureMessage) {
        this.status = ExperimentStatus.FAILED;
        this.completedAt = Instant.now();
        this.failureMessage = failureMessage;
    }

    public UUID getId() {
        return id;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getCompletedAt() {
        return completedAt;
    }

    public ExperimentStatus getStatus() {
        return status;
    }

    public int getRequestedVehicleCount() {
        return requestedVehicleCount;
    }

    public Integer getInitialVehicleCount() {
        return initialVehicleCount;
    }

    public long getSeed() {
        return seed;
    }

    public boolean isComparisonEnabled() {
        return comparisonEnabled;
    }

    public String getClosureConfig() {
        return closureConfig;
    }

    public Integer getScenarioActiveVehicles() {
        return scenarioActiveVehicles;
    }

    public Double getScenarioThroughputPerMinute() {
        return scenarioThroughputPerMinute;
    }

    public Integer getScenarioCompletedTrips() {
        return scenarioCompletedTrips;
    }

    public Double getScenarioSimulationTimeSeconds() {
        return scenarioSimulationTimeSeconds;
    }

    public Integer getBaselineActiveVehicles() {
        return baselineActiveVehicles;
    }

    public Double getBaselineThroughputPerMinute() {
        return baselineThroughputPerMinute;
    }

    public Integer getBaselineCompletedTrips() {
        return baselineCompletedTrips;
    }

    public Double getBaselineSimulationTimeSeconds() {
        return baselineSimulationTimeSeconds;
    }

    public Double getThroughputDeltaPercent() {
        return throughputDeltaPercent;
    }

    public Double getSimulationDurationSeconds() {
        return simulationDurationSeconds;
    }

    public String getCompletionReason() {
        return completionReason;
    }

    public String getFailureMessage() {
        return failureMessage;
    }
}

CREATE TABLE IF NOT EXISTS experiments (
    id UUID PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) NOT NULL,
    requested_vehicle_count INTEGER NOT NULL,
    initial_vehicle_count INTEGER,
    seed BIGINT NOT NULL,
    comparison_enabled BOOLEAN NOT NULL,
    closure_config TEXT NOT NULL,

    scenario_active_vehicles INTEGER,
    scenario_throughput_per_minute DOUBLE PRECISION,
    scenario_completed_trips INTEGER,
    scenario_simulation_time_seconds DOUBLE PRECISION,

    baseline_active_vehicles INTEGER,
    baseline_throughput_per_minute DOUBLE PRECISION,
    baseline_completed_trips INTEGER,
    baseline_simulation_time_seconds DOUBLE PRECISION,

    throughput_delta_percent DOUBLE PRECISION,
    simulation_duration_seconds DOUBLE PRECISION,
    completion_reason VARCHAR(64),
    failure_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_experiments_created_at
    ON experiments (created_at DESC);

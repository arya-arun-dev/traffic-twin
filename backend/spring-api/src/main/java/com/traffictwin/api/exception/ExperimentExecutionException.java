package com.traffictwin.api.exception;

import java.util.UUID;

public class ExperimentExecutionException extends RuntimeException {

    private final UUID experimentId;

    public ExperimentExecutionException(UUID experimentId, String message, Throwable cause) {
        super(message, cause);
        this.experimentId = experimentId;
    }

    public UUID getExperimentId() {
        return experimentId;
    }
}

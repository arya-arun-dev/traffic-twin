package com.traffictwin.api.exception;

import java.util.UUID;

public class ExperimentNotFoundException extends RuntimeException {
    public ExperimentNotFoundException(UUID id) {
        super("Experiment " + id + " was not found.");
    }
}

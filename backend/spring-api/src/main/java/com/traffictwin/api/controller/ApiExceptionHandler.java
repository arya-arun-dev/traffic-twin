package com.traffictwin.api.controller;

import com.traffictwin.api.exception.ExperimentExecutionException;
import com.traffictwin.api.exception.ExperimentNotFoundException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class ApiExceptionHandler {

    @ExceptionHandler(ExperimentNotFoundException.class)
    ProblemDetail handleNotFound(ExperimentNotFoundException exception) {
        ProblemDetail detail = ProblemDetail.forStatusAndDetail(
                HttpStatus.NOT_FOUND,
                exception.getMessage()
        );
        detail.setTitle("Experiment not found");
        return detail;
    }

    @ExceptionHandler(ExperimentExecutionException.class)
    ProblemDetail handleExecutionFailure(ExperimentExecutionException exception) {
        ProblemDetail detail = ProblemDetail.forStatusAndDetail(
                HttpStatus.BAD_GATEWAY,
                exception.getMessage()
        );
        detail.setTitle("Experiment execution failed");
        detail.setProperty("experimentId", exception.getExperimentId());
        return detail;
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ProblemDetail handleValidationFailure(MethodArgumentNotValidException exception) {
        ProblemDetail detail = ProblemDetail.forStatusAndDetail(
                HttpStatus.BAD_REQUEST,
                "The experiment request is invalid."
        );
        detail.setTitle("Invalid experiment request");
        detail.setProperty(
                "errors",
                exception.getBindingResult()
                        .getFieldErrors()
                        .stream()
                        .map(error -> error.getField() + ": " + error.getDefaultMessage())
                        .toList()
        );
        return detail;
    }
}

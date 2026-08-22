package com.traffictwin.api.controller;

import com.traffictwin.api.dto.ExperimentRequest;
import com.traffictwin.api.dto.ExperimentResponse;
import com.traffictwin.api.service.ExperimentService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/experiments")
public class ExperimentController {

    private final ExperimentService experimentService;

    public ExperimentController(ExperimentService experimentService) {
        this.experimentService = experimentService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ExperimentResponse create(@Valid @RequestBody ExperimentRequest request) {
        return experimentService.runExperiment(request);
    }

    @GetMapping("/{id}")
    public ExperimentResponse get(@PathVariable UUID id) {
        return experimentService.getExperiment(id);
    }

    @GetMapping
    public List<ExperimentResponse> list() {
        return experimentService.listExperiments();
    }
}

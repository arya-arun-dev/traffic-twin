package com.traffictwin.api.repository;

import com.traffictwin.api.entity.Experiment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ExperimentRepository extends JpaRepository<Experiment, UUID> {
    List<Experiment> findAllByOrderByCreatedAtDesc();
}

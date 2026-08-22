package com.traffictwin.api.service;

import com.traffictwin.api.dto.SimulationServiceRequest;
import com.traffictwin.api.dto.SimulationServiceResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.net.http.HttpClient;
import java.time.Duration;

@Component
public class SimulationServiceClient {

    private final RestClient restClient;

    public SimulationServiceClient(
        @Value("${traffic-twin.simulation-service-url}") String simulationServiceUrl
    ) {
        HttpClient httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .build();

        JdkClientHttpRequestFactory requestFactory =
                new JdkClientHttpRequestFactory(httpClient);
        requestFactory.setReadTimeout(Duration.ofMinutes(5));

        this.restClient = RestClient.builder()
                .baseUrl(simulationServiceUrl)
                .requestFactory(requestFactory)
                .build();
    }

    public SimulationServiceResponse run(SimulationServiceRequest request) {
        SimulationServiceResponse response = restClient.post()
                .uri("/simulate")
                .body(request)
                .retrieve()
                .body(SimulationServiceResponse.class);

        if (response == null) {
            throw new IllegalStateException("Simulation service returned an empty response.");
        }

        return response;
    }
}

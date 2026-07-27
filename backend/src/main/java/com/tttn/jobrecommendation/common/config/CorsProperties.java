package com.tttn.jobrecommendation.common.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.LinkedHashSet;
import java.util.List;

@ConfigurationProperties(prefix = "app.cors")
public record CorsProperties(
        List<String> allowedOrigins,
        boolean allowCredentials
) {

    public CorsProperties {
        LinkedHashSet<String> normalizedOrigins = new LinkedHashSet<>();
        if (allowedOrigins != null) {
            allowedOrigins.stream()
                    .filter(origin -> origin != null && !origin.isBlank())
                    .map(String::trim)
                    .forEach(normalizedOrigins::add);
        }

        if (normalizedOrigins.isEmpty()) {
            throw new IllegalArgumentException("app.cors.allowed-origins must contain at least one origin");
        }
        if (allowCredentials && normalizedOrigins.contains("*")) {
            throw new IllegalArgumentException(
                    "app.cors.allowed-origins cannot contain '*' when credentials are enabled"
            );
        }

        allowedOrigins = List.copyOf(normalizedOrigins);
    }
}

package com.tttn.jobrecommendation.common.config;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class CorsConfigTest {

    @Test
    void normalizesConfiguredOriginsAndUsesBearerFriendlyDefaults() {
        CorsProperties properties = new CorsProperties(
                List.of(
                        " http://localhost:5173 ",
                        "https://demo.example.com",
                        "http://localhost:5173",
                        " "
                ),
                false
        );

        CorsConfigurationSource source = new CorsConfig().corsConfigurationSource(properties);
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/public/jobs");
        CorsConfiguration configuration = source.getCorsConfiguration(request);

        assertThat(properties.allowedOrigins()).containsExactly(
                "http://localhost:5173",
                "https://demo.example.com"
        );
        assertThat(configuration).isNotNull();
        assertThat(configuration.getAllowedOrigins()).containsExactlyElementsOf(properties.allowedOrigins());
        assertThat(configuration.getAllowedMethods()).containsExactly(
                "GET",
                "POST",
                "PUT",
                "PATCH",
                "DELETE",
                "OPTIONS"
        );
        assertThat(configuration.getAllowedHeaders()).containsExactly(
                "Authorization",
                "Content-Type",
                "Accept",
                "Origin"
        );
        assertThat(configuration.getExposedHeaders()).containsExactly("Content-Disposition");
        assertThat(configuration.getAllowCredentials()).isFalse();
    }

    @Test
    void rejectsEmptyOriginConfiguration() {
        assertThatThrownBy(() -> new CorsProperties(List.of(" ", ""), false))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("allowed-origins");
    }

    @Test
    void rejectsWildcardWhenCredentialsAreEnabled() {
        assertThatThrownBy(() -> new CorsProperties(List.of("*"), true))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("credentials");
    }
}

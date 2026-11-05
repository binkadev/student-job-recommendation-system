package com.tttn.jobrecommendation.integration;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tttn.jobrecommendation.common.enums.NotificationType;
import com.tttn.jobrecommendation.common.enums.UserRole;
import com.tttn.jobrecommendation.modules.notification.entity.Notification;
import com.tttn.jobrecommendation.modules.notification.repository.NotificationRepository;
import com.tttn.jobrecommendation.modules.user.entity.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class NotificationApiIT extends AbstractPostgresWebIntegrationTest {
    @Autowired NotificationRepository notifications;
    @Autowired ObjectMapper objectMapper;
    private User student;
    private User company;
    private final List<Notification> own = new ArrayList<>();
    private Notification foreign;

    @BeforeEach
    void fixtures() {
        student = createUser("notification-student@example.test", UserRole.STUDENT);
        company = createUser("notification-company@example.test", UserRole.COMPANY);
        own.clear();
        for (int i = 0; i < 48; i++) {
            own.add(notifications.saveAndFlush(Notification.builder().user(student)
                    .type(NotificationType.values()[i % 4]).title("Notice " + i).message("Synthetic test")
                    .read(i % 3 == 0).build()));
        }
        foreign = notifications.saveAndFlush(Notification.builder().user(company).type(NotificationType.SYSTEM)
                .title("Foreign notice").message("Private synthetic test").read(false).build());
        // Deliberate timestamp ties expose unstable ordering. Isolated Testcontainer only.
        jdbcTemplate.update("update notifications set created_at = timestamp '2026-01-01 00:00:00'");
    }

    @Test
    void filtersAndCountsBeforePaginationWithStableTiesAndNoForeignRows() throws Exception {
        List<Long> ids = new ArrayList<>();
        for (int page = 1; page <= 3; page++) {
            JsonNode data = list(student, "?unread=true&type=SYSTEM&size=3&page=" + page);
            assertThat(data.get("totalItems").asInt()).isEqualTo(8);
            assertThat(data.get("totalPages").asInt()).isEqualTo(3);
            for (JsonNode item : data.get("items")) {
                assertThat(item.get("isRead").asBoolean()).isFalse();
                assertThat(item.get("type").asText()).isEqualTo("SYSTEM");
                ids.add(item.get("id").asLong());
            }
        }
        assertThat(ids).containsExactly(47L, 39L, 35L, 27L, 23L, 15L, 11L, 3L);
        assertThat(list(student, "?unread=false&type=SYSTEM").get("totalItems").asInt()).isEqualTo(4);
        assertThat(list(student, "?type=RECOMMENDATION").get("totalItems").asInt()).isEqualTo(12);
        assertThat(list(company, "?unread=true&type=SYSTEM").get("totalItems").asInt()).isEqualTo(1);
    }

    @Test
    void unfilteredCompatibilityEmptyAndOutOfRangePages() throws Exception {
        JsonNode data = list(student, "");
        assertThat(data.get("size").asInt()).isEqualTo(20);
        assertThat(data.get("totalItems").asInt()).isEqualTo(48);
        assertThat(data.get("items").get(0).get("id").asLong()).isEqualTo(48);
        JsonNode outside = list(student, "?unread=true&type=SYSTEM&page=99&size=3");
        assertThat(outside.get("items")).isEmpty();
        assertThat(outside.get("totalItems").asInt()).isEqualTo(8);
        assertThat(list(company, "?type=RECOMMENDATION").get("totalPages").asInt()).isZero();
    }

    @Test
    void invalidFiltersPaginationAndIdsReturnErrors() throws Exception {
        for (String query : List.of("?page=0", "?size=0", "?size=101", "?type=EMAIL", "?unread=maybe")) {
            mockMvc.perform(get("/api/notifications" + query).header("Authorization", bearerToken(student)))
                    .andExpect(status().isBadRequest()).andExpect(jsonPath("$.success").value(false));
        }
        for (long id : new long[]{0, -1, Long.MAX_VALUE, foreign.getId()}) {
            mockMvc.perform(patch("/api/notifications/{id}/read", id).header("Authorization", bearerToken(student)))
                    .andExpect(status().isNotFound()).andExpect(jsonPath("$.data").isEmpty());
        }
        mockMvc.perform(get("/api/notifications")).andExpect(status().isUnauthorized());
        mockMvc.perform(patch("/api/notifications/read-all")).andExpect(status().isUnauthorized());
        assertThat(notifications.findById(foreign.getId()).orElseThrow().isRead()).isFalse();
    }

    @Test
    void markOneIsIdempotentAndCountIsIndependentOfCurrentFilter() throws Exception {
        long id = own.get(1).getId();
        mockMvc.perform(patch("/api/notifications/{id}/read", id).header("Authorization", bearerToken(student)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.isRead").value(true));
        var readAt = notifications.findById(id).orElseThrow().getReadAt();
        mockMvc.perform(patch("/api/notifications/{id}/read", id).header("Authorization", bearerToken(student)))
                .andExpect(status().isOk());
        assertThat(notifications.findById(id).orElseThrow().getReadAt()).isEqualTo(readAt);
        mockMvc.perform(get("/api/notifications/unread-count").header("Authorization", bearerToken(student)))
                .andExpect(jsonPath("$.data.unreadCount").value(31));
        assertThat(list(student, "?unread=true&type=SYSTEM").get("totalItems").asInt()).isEqualTo(8);
    }

    @Test
    void concurrentReadOneAndAllRemainOwnedAndPersisted() throws Exception {
        var start = new CountDownLatch(1);
        try (var pool = Executors.newFixedThreadPool(4)) {
            var tasks = new ArrayList<java.util.concurrent.Future<Integer>>();
            for (String path : List.of("/read-all", "/2/read", "/read-all", "/2/read")) {
                tasks.add(pool.submit(() -> {
                    start.await();
                    return mockMvc.perform(patch("/api/notifications" + path)
                            .header("Authorization", bearerToken(student))).andReturn().getResponse().getStatus();
                }));
            }
            start.countDown();
            for (var task : tasks) assertThat(task.get(15, TimeUnit.SECONDS)).isEqualTo(200);
        }
        assertThat(notifications.countByUserIdAndReadFalse(student.getId())).isZero();
        assertThat(notifications.countByUserIdAndReadFalse(company.getId())).isEqualTo(1);
        assertThat(list(student, "?unread=true").get("totalItems").asInt()).isZero();
        assertThat(notifications.findById(2L).orElseThrow().getReadAt()).isNotNull();
    }

    private JsonNode list(User user, String query) throws Exception {
        String body = mockMvc.perform(get("/api/notifications" + query).header("Authorization", bearerToken(user)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(body).get("data");
    }
}

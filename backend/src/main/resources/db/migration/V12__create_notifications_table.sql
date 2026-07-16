CREATE TABLE notifications (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    reference_type VARCHAR(50),
    reference_id BIGINT,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    read_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_notifications_user_id FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE RESTRICT
);

CREATE INDEX idx_notifications_user_id ON notifications (user_id);
CREATE INDEX idx_notifications_user_read ON notifications (user_id, is_read);
CREATE INDEX idx_notifications_created_at ON notifications (created_at);

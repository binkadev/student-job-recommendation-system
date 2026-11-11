-- Private Application-scoped history; no existing business rows are changed.
CREATE TABLE conversations (
    id BIGSERIAL PRIMARY KEY,
    application_id BIGINT NOT NULL UNIQUE REFERENCES applications(id) ON DELETE RESTRICT,
    company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
    student_id BIGINT NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
    last_message_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_conversations_company_activity ON conversations(company_id, COALESCE(last_message_at, created_at) DESC, id DESC);
CREATE INDEX idx_conversations_student_activity ON conversations(student_id, COALESCE(last_message_at, created_at) DESC, id DESC);

CREATE TABLE messages (
    id BIGSERIAL PRIMARY KEY,
    conversation_id BIGINT NOT NULL REFERENCES conversations(id) ON DELETE RESTRICT,
    sender_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    sender_role VARCHAR(20) NOT NULL CHECK (sender_role IN ('STUDENT', 'COMPANY')),
    content TEXT NOT NULL CHECK (content ~ '[^[:space:]]' AND char_length(content) <= 5000),
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_messages_conversation_chronological ON messages(conversation_id, created_at, id);
CREATE INDEX idx_messages_unread_sender ON messages(conversation_id, sender_user_id) WHERE is_read = FALSE;

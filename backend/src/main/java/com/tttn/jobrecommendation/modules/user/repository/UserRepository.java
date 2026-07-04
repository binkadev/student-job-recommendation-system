package com.tttn.jobrecommendation.modules.user.repository;

import com.tttn.jobrecommendation.modules.user.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserRepository extends JpaRepository<User, Long> {
}

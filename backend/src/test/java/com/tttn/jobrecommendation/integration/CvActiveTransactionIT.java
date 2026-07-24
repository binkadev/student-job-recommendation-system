package com.tttn.jobrecommendation.integration;

import com.tttn.jobrecommendation.modules.cv.dto.response.CvFileResponse;
import com.tttn.jobrecommendation.modules.cv.entity.CvFile;
import com.tttn.jobrecommendation.modules.cv.service.CvService;
import com.tttn.jobrecommendation.modules.student.entity.Student;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class CvActiveTransactionIT extends AbstractPostgresIntegrationTest {

    @Autowired
    private CvService cvService;

    @Test
    void activateCvSwitchesTheActiveCvAndIsIdempotent() {
        Student student = createStudent("cv-transaction@student.test");
        CvFile cvA = createCv(student, "cv-a.pdf", true);
        CvFile cvB = createCv(student, "cv-b.pdf", false);

        CvFileResponse firstActivation = cvService.activateCv(student.getUser().getId(), cvB.getId());

        assertThat(firstActivation.getId()).isEqualTo(cvB.getId());
        assertThat(firstActivation.isActive()).isTrue();
        assertActiveState(student.getId(), cvA.getId(), cvB.getId());

        CvFileResponse secondActivation = cvService.activateCv(student.getUser().getId(), cvB.getId());

        assertThat(secondActivation.getId()).isEqualTo(cvB.getId());
        assertThat(secondActivation.isActive()).isTrue();
        assertActiveState(student.getId(), cvA.getId(), cvB.getId());
    }

    private void assertActiveState(Long studentId, Long inactiveCvId, Long activeCvId) {
        CvFile reloadedInactiveCv = cvFileRepository.findById(inactiveCvId).orElseThrow();
        CvFile reloadedActiveCv = cvFileRepository.findById(activeCvId).orElseThrow();
        List<CvFile> studentCvFiles = cvFileRepository.findByStudentIdOrderByUploadedAtDesc(studentId);

        assertThat(reloadedInactiveCv.isActive()).isFalse();
        assertThat(reloadedActiveCv.isActive()).isTrue();
        assertThat(studentCvFiles)
                .filteredOn(CvFile::isActive)
                .extracting(CvFile::getId)
                .containsExactly(activeCvId);
    }
}

package com.tttn.jobrecommendation.modules.cv.service;

import com.tttn.jobrecommendation.modules.cv.dto.response.CvFileResponse;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

public interface CvService {

    CvFileResponse uploadCv(Long userId, MultipartFile file, boolean active);

    List<CvFileResponse> getMyCvFiles(Long userId);

    CvFileResponse getActiveCv(Long userId);

    CvFileResponse getMyCvFile(Long userId, Long id);

    CvFileResponse activateCv(Long userId, Long id);
}

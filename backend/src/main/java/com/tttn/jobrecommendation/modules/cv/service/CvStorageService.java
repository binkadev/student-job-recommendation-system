package com.tttn.jobrecommendation.modules.cv.service;

import com.tttn.jobrecommendation.modules.cv.dto.response.CvFileDownload;
import com.tttn.jobrecommendation.modules.cv.entity.CvFile;

public interface CvStorageService {

    CvFileDownload load(CvFile cvFile);

    void delete(CvFile cvFile);
}

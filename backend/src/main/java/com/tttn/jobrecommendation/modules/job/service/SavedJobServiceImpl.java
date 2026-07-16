package com.tttn.jobrecommendation.modules.job.service;

import com.tttn.jobrecommendation.common.enums.JobStatus;
import com.tttn.jobrecommendation.common.exception.AppException;
import com.tttn.jobrecommendation.common.exception.ErrorCode;
import com.tttn.jobrecommendation.common.exception.ResourceNotFoundException;
import com.tttn.jobrecommendation.common.response.PageResponse;
import com.tttn.jobrecommendation.modules.job.dto.response.SavedJobResponse;
import com.tttn.jobrecommendation.modules.job.entity.Job;
import com.tttn.jobrecommendation.modules.job.entity.SavedJob;
import com.tttn.jobrecommendation.modules.job.mapper.SavedJobMapper;
import com.tttn.jobrecommendation.modules.job.repository.JobRepository;
import com.tttn.jobrecommendation.modules.job.repository.SavedJobRepository;
import com.tttn.jobrecommendation.modules.student.entity.Student;
import com.tttn.jobrecommendation.modules.student.repository.StudentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class SavedJobServiceImpl implements SavedJobService {

    private final SavedJobRepository savedJobRepository;
    private final JobRepository jobRepository;
    private final StudentRepository studentRepository;
    private final SavedJobMapper savedJobMapper;

    @Override
    @Transactional
    public SavedJobResponse saveJob(Long userId, Long jobId) {
        Student student = getStudentByUserId(userId);
        Job job = getJobById(jobId);

        if (job.getStatus() != JobStatus.ACTIVE) {
            throw new AppException(ErrorCode.BAD_REQUEST, "Only active jobs can be saved");
        }

        if (savedJobRepository.existsByStudentIdAndJobId(student.getId(), job.getId())) {
            throw new AppException(ErrorCode.BAD_REQUEST, "Job is already saved");
        }

        SavedJob savedJob = SavedJob.builder()
                .student(student)
                .job(job)
                .build();

        try {
            return savedJobMapper.toSavedJobResponse(savedJobRepository.save(savedJob));
        } catch (DataIntegrityViolationException exception) {
            throw new AppException(ErrorCode.BAD_REQUEST, "Job is already saved");
        }
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<SavedJobResponse> getMySavedJobs(Long userId, Integer page, Integer size) {
        Student student = getStudentByUserId(userId);
        Pageable pageable = PageRequest.of(
                Math.max(page == null ? 1 : page, 1) - 1,
                Math.min(Math.max(size == null ? 10 : size, 1), 100),
                Sort.by(Sort.Direction.DESC, "createdAt")
        );

        Page<SavedJob> savedJobs = savedJobRepository.findByStudentIdOrderByCreatedAtDesc(student.getId(), pageable);
        List<SavedJobResponse> items = savedJobs.getContent()
                .stream()
                .map(savedJobMapper::toSavedJobResponse)
                .toList();

        return new PageResponse<>(
                items,
                savedJobs.getNumber() + 1,
                savedJobs.getSize(),
                savedJobs.getTotalElements(),
                savedJobs.getTotalPages()
        );
    }

    @Override
    @Transactional
    public void removeSavedJob(Long userId, Long jobId) {
        Student student = getStudentByUserId(userId);
        SavedJob savedJob = savedJobRepository.findByStudentIdAndJobId(student.getId(), jobId)
                .orElseThrow(() -> new ResourceNotFoundException("Saved job not found"));
        savedJobRepository.delete(savedJob);
    }

    private Student getStudentByUserId(Long userId) {
        return studentRepository.findByUserId(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Student profile not found"));
    }

    private Job getJobById(Long jobId) {
        return jobRepository.findById(jobId)
                .orElseThrow(() -> new ResourceNotFoundException("Job not found"));
    }
}

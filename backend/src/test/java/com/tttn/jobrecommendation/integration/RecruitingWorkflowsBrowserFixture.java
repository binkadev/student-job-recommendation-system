package com.tttn.jobrecommendation.integration;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tttn.jobrecommendation.JobRecommendationApplication;
import com.tttn.jobrecommendation.common.enums.*;
import com.tttn.jobrecommendation.modules.application.entity.JobApplication;
import com.tttn.jobrecommendation.modules.application.repository.JobApplicationRepository;
import com.tttn.jobrecommendation.modules.company.entity.Company;
import com.tttn.jobrecommendation.modules.company.entity.SavedCandidate;
import com.tttn.jobrecommendation.modules.company.repository.CompanyRepository;
import com.tttn.jobrecommendation.modules.company.repository.SavedCandidateRepository;
import com.tttn.jobrecommendation.modules.interview.entity.Interview;
import com.tttn.jobrecommendation.modules.interview.repository.InterviewRepository;
import com.tttn.jobrecommendation.modules.invitation.entity.JobInvitation;
import com.tttn.jobrecommendation.modules.invitation.repository.JobInvitationRepository;
import com.tttn.jobrecommendation.modules.job.entity.Job;
import com.tttn.jobrecommendation.modules.job.repository.JobRepository;
import com.tttn.jobrecommendation.modules.student.entity.Student;
import com.tttn.jobrecommendation.modules.student.repository.StudentRepository;
import com.tttn.jobrecommendation.modules.user.entity.User;
import com.tttn.jobrecommendation.modules.user.repository.UserRepository;
import jakarta.persistence.EntityManagerFactory;
import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.MigrationInfo;
import org.flywaydb.core.api.MigrationState;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.boot.web.servlet.context.ServletWebServerApplicationContext;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.testcontainers.containers.PostgreSQLContainer;
import java.nio.file.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.sql.Connection;
import java.time.*;
import java.util.*;
import java.util.stream.IntStream;

/** Dedicated disposable recruiting fixture. Control files never create an HTTP/production bypass. */
public class RecruitingWorkflowsBrowserFixture {
    public static void main(String[] args) throws Exception {
        Path output=Path.of(args[0]).toAbsolutePath(), local=output.getParent(), stop=Path.of(output+".stop");
        String runId=local.getFileName().toString();
        if(!runId.matches("recruiting-workflows-[a-f0-9]{32}")) throw new IllegalArgumentException("Dedicated runner directory required");
        Path temporary=Files.createTempDirectory("sjrs-recruiting-e2e-").toRealPath();
        try(var postgres=new PostgreSQLContainer<>("postgres:17-alpine").withLabel("sjrs.recruiting.run",runId)) {
            // Separate from readiness/credentials: available even if container or application startup fails.
            recordOwnership(local,runId,temporary,null);
            Files.deleteIfExists(stop);
            postgres.start();
            recordOwnership(local,runId,temporary,postgres.getContainerId());
            try(var context=new SpringApplicationBuilder(JobRecommendationApplication.class).profiles("integration").run(
                    "--spring.profiles.active=integration", "--server.address=127.0.0.1", "--server.port=0",
                    "--spring.datasource.url="+postgres.getJdbcUrl(), "--spring.datasource.username="+postgres.getUsername(),
                    "--spring.datasource.password="+postgres.getPassword(), "--app.jwt.secret="+UUID.randomUUID()+UUID.randomUUID(),
                    "--app.upload.cv.storage-dir="+temporary.resolve("cvs"),
                    "--app.upload.company-verification.storage-dir="+temporary.resolve("private-documents"),
                    "--spring.jpa.show-sql=false", "--logging.level.org.springframework.web=INFO", "--logging.level.org.hibernate.SQL=INFO")) {
                var users=context.getBean(UserRepository.class); var companies=context.getBean(CompanyRepository.class);
                var students=context.getBean(StudentRepository.class); var jobs=context.getBean(JobRepository.class);
                var applications=context.getBean(JobApplicationRepository.class); var interviews=context.getBean(InterviewRepository.class);
                var invitations=context.getBean(JobInvitationRepository.class); var jdbc=context.getBean(JdbcTemplate.class);
                var mapper=context.getBean(ObjectMapper.class); var encoder=context.getBean(PasswordEncoder.class);
                if(!Arrays.equals(context.getEnvironment().getActiveProfiles(),new String[]{"integration"}) || users.count()!=0 || companies.count()!=0 || students.count()!=0 || jobs.count()!=0)
                    throw new IllegalStateException("Fresh integration-only database required; no seeded user/job data");
                var accounts=new LinkedHashMap<String,Object>(); var people=new HashMap<String,User>();
                for(String alias:new String[]{"company","otherCompany","student","otherStudent","admin"}) {
                    UserRole role=alias.equals("admin")?UserRole.ADMIN:alias.toLowerCase(Locale.ROOT).contains("company")?UserRole.COMPANY:UserRole.STUDENT;
                    String password=UUID.randomUUID()+"A9!";
                    var user=users.saveAndFlush(User.builder().email(alias.toLowerCase(Locale.ROOT)+"@isolated-w3c1c.invalid")
                            .fullName("Isolated "+alias).passwordHash(encoder.encode(password)).role(role).status(UserStatus.ACTIVE).build());
                    people.put(alias,user);
                    accounts.put(alias,new LinkedHashMap<>(Map.of("email",user.getEmail(),"password",password,"userId",user.getId())));
                }
                var owner=companies.saveAndFlush(Company.builder().user(people.get("company")).companyName("Recruiting Owner").status(CompanyStatus.VERIFIED).build());
                var other=companies.saveAndFlush(Company.builder().user(people.get("otherCompany")).companyName("Recruiting Other").status(CompanyStatus.VERIFIED).build());
                var student=students.saveAndFlush(Student.builder().user(people.get("student")).studentCode("REC-A").build());
                var foreign=students.saveAndFlush(Student.builder().user(people.get("otherStudent")).studentCode("REC-B").build());
                var ids=new LinkedHashMap<String,Long>();
                ids.put("company",owner.getId());ids.put("otherCompany",other.getId());ids.put("student",student.getId());ids.put("otherStudent",foreign.getId());
                var roles=new LinkedHashMap<String,Job>();
                for(String alias:new String[]{"sourceJob","applicantJob","savedJob","duplicateJob","conflictJob"}) {
                    var job=jobs.saveAndFlush(Job.builder().company(owner).title("Recruiting "+alias).description("Synthetic recruiting role")
                            .jobType(JobType.INTERNSHIP).workingModel(WorkingModel.REMOTE).status(JobStatus.ACTIVE).deadline(LocalDate.now().plusMonths(2)).build());
                    roles.put(alias,job);ids.put(alias,job.getId());
                }
                var foreignJob=jobs.saveAndFlush(Job.builder().company(other).title("Other private role").description("Synthetic other role")
                        .jobType(JobType.INTERNSHIP).workingModel(WorkingModel.ONSITE).status(JobStatus.ACTIVE).deadline(LocalDate.now().plusMonths(2)).build());
                ids.put("foreignJob",foreignJob.getId());
                var app=applications.saveAndFlush(JobApplication.builder().student(student).job(roles.get("sourceJob")).status(ApplicationStatus.REVIEWED).build());
                var foreignApp=applications.saveAndFlush(JobApplication.builder().student(foreign).job(foreignJob).status(ApplicationStatus.REVIEWED).build());
                ids.put("application",app.getId());ids.put("foreignApplication",foreignApp.getId());
                var saved=context.getBean(SavedCandidateRepository.class).saveAndFlush(SavedCandidate.builder().company(owner).student(student).application(app).build());
                ids.put("savedCandidate",saved.getId());
                // Set up a coherent historical timeline once, before browser scenarios; never reset protected history later.
                LocalDateTime now=LocalDateTime.now(), future=now.plusDays(2).withSecond(0).withNano(0);
                jdbc.update("update users set created_at=?,updated_at=?",now.minusDays(40),now.minusDays(40));
                jdbc.update("update companies set created_at=?,updated_at=?",now.minusDays(30),now.minusDays(30));
                jdbc.update("update students set created_at=?,updated_at=?",now.minusDays(35),now.minusDays(35));
                jdbc.update("update jobs set created_at=?,updated_at=?,published_at=?",now.minusDays(20),now.minusDays(19),now.minusDays(19));
                jdbc.update("update applications set applied_at=?,created_at=?,reviewed_at=?,updated_at=?",now.minusDays(10),now.minusDays(10),now.minusDays(9),now.minusDays(9));
                jdbc.update("update saved_candidates set created_at=?,updated_at=?",now.minusDays(8),now.minusDays(8));
                for(int i=0;i<101;i++) {
                    var interview=interviews.saveAndFlush(Interview.builder().application(app).company(owner).student(student).job(roles.get("sourceJob"))
                            .title(i==0?"Deep historical interview":"Historical round "+i).scheduledAt(now.minusDays(2).plusMinutes(i)).durationMinutes(30)
                            .meetingType(MeetingType.ONSITE).locationOrLink("Synthetic meeting room").status(InterviewStatus.COMPLETED).build());
                    var invitation=invitations.saveAndFlush(JobInvitation.builder().company(owner).student(student).job(roles.get("applicantJob"))
                            .message(i==0?"Deep historical invitation":"Synthetic historical invitation "+i).status(InvitationStatus.DECLINED).build());
                    jdbc.update("update interviews set created_at=?,updated_at=? where id=?",now.minusDays(7).plusSeconds(i),now.minusDays(2).plusMinutes(i+30),interview.getId());
                    jdbc.update("update job_invitations set created_at=?,updated_at=? where id=?",now.minusDays(7).plusSeconds(i),now.minusDays(6).plusSeconds(i),invitation.getId());
                    if(i==0){ids.put("deepInterview",interview.getId());ids.put("deepInvitation",invitation.getId());}
                }
                var historical=interviews.saveAndFlush(Interview.builder().application(app).company(owner).student(student).job(roles.get("sourceJob"))
                        .title("Historical confirmed completion").scheduledAt(now.minusDays(1)).durationMinutes(60).meetingType(MeetingType.ONSITE)
                        .locationOrLink("Synthetic meeting room").status(InterviewStatus.CONFIRMED).build());
                jdbc.update("update interviews set created_at=?,updated_at=? where id=?",now.minusDays(3),now.minusDays(3).plusHours(1),historical.getId());
                ids.put("historicalConfirmed",historical.getId());
                var foreignInterview=interviews.saveAndFlush(Interview.builder().application(foreignApp).company(other).student(foreign).job(foreignJob)
                        .title("Foreign private interview").scheduledAt(future).durationMinutes(60).meetingType(MeetingType.ONLINE)
                        .locationOrLink("https://meet.example.test/foreign").status(InterviewStatus.SCHEDULED).build());
                var foreignInvitation=invitations.saveAndFlush(JobInvitation.builder().company(other).student(foreign).job(foreignJob)
                        .message("Foreign private invitation").status(InvitationStatus.PENDING).build());
                ids.put("foreignInterview",foreignInterview.getId());ids.put("foreignInvitation",foreignInvitation.getId());
                var flyway=context.getBean(Flyway.class);
                var expectedVersions=IntStream.rangeClosed(1,25).mapToObj(Integer::toString).toList();
                var migrationInfo=flyway.info();
                var applied=Arrays.stream(migrationInfo.applied()).filter(MigrationInfo::isVersioned).toList();
                int postgresMajor=jdbc.queryForObject("select current_setting('server_version_num')::int/10000",Integer.class);
                if(postgresMajor!=17 || !applied.stream().map(m->m.getVersion().getVersion()).toList().equals(expectedVersions)
                        || applied.stream().anyMatch(m->m.getState()!=MigrationState.SUCCESS || m.getChecksum()==null)
                        || !jdbc.queryForList("select version from flyway_schema_history where version is not null order by installed_rank",String.class).equals(expectedVersions)
                        || migrationInfo.current()==null || !"25".equals(migrationInfo.current().getVersion().getVersion())
                        || migrationInfo.pending().length!=0 || !flyway.validateWithResult().validationSuccessful)
                    throw new IllegalStateException("PostgreSQL17 and exact successful V1-V25/checksum validation required");
                if(!context.getBean(EntityManagerFactory.class).isOpen() || !"validate".equals(context.getEnvironment().getProperty("spring.jpa.hibernate.ddl-auto"))) throw new IllegalStateException("Hibernate validation required");
                mapper.writeValue(local.resolve("validation.json").toFile(),Map.of("postgresMajor",postgresMajor,
                        "migrationVersions",expectedVersions,"currentVersion","25","successfulVersionedMigrations",applied.size(),
                        "flywayChecksumsValidated",true,"hibernateSchemaValidation",true));
                if(args.length==2 && "--setup-failure-probe".equals(args[1])) {
                    mapper.writeValue(local.resolve("setup-failure-probe.json").toFile(),Map.of("intentional",true,"beforeReadiness",true));
                    throw new IllegalStateException("Intentional setup failure before readiness");
                }
                var metadata=new LinkedHashMap<String,Object>();
                metadata.put("backendUrl","http://127.0.0.1:"+((ServletWebServerApplicationContext)context).getWebServer().getPort());
                metadata.put("accounts",accounts);metadata.put("ids",ids);metadata.put("futureAt",future.toString());
                metadata.put("serverZone",ZoneId.systemDefault().getId());metadata.put("temporaryRoot",temporary.toString());
                metadata.put("containerId",postgres.getContainerId());metadata.put("postgresImage","postgres:17-alpine");
                metadata.put("activeProfiles",Arrays.asList(context.getEnvironment().getActiveProfiles()));metadata.put("initialDatabase",snapshot(jdbc));metadata.put("hibernateSchemaValidation",true);
                Path ready=local.resolve("fixture.tmp");mapper.writeValue(ready.toFile(),metadata);Files.move(ready,output,StandardCopyOption.ATOMIC_MOVE);
                System.out.println("Isolated recruiting fixture READY.");
                Connection held=null; long lockDeadline=0, deadline=System.nanoTime()+Duration.ofMinutes(20).toNanos();
                try {
                    while(!Files.exists(stop) && System.nanoTime()<deadline) {
                        if(held!=null && System.nanoTime()>lockDeadline){held.rollback();held.close();held=null;}
                        Path command=local.resolve("control.json");
                        if(Files.exists(command)) {
                            var input=mapper.readTree(command.toFile());Files.delete(command);
                            String id=UUID.fromString(input.path("id").asText()).toString(), action=input.path("action").asText();
                            Map<String,Object> reply;
                            switch(action) {
                                case "snapshot" -> { if(held!=null) throw new IllegalStateException("Release lock before snapshot");reply=snapshot(jdbc); }
                                case "hold" -> {
                                    if(held!=null) throw new IllegalStateException("Lock already held");
                                    held=java.sql.DriverManager.getConnection(postgres.getJdbcUrl(),postgres.getUsername(),postgres.getPassword());held.setAutoCommit(false);
                                    try(var statement=held.createStatement()){statement.execute("lock table interviews in access exclusive mode");}
                                    lockDeadline=System.nanoTime()+Duration.ofSeconds(25).toNanos();reply=Map.of("held",true);
                                }
                                case "waiters" -> {
                                    if(held==null) throw new IllegalStateException("No lock held");
                                    try(var statement=held.createStatement()) {
                                        statement.execute("select pg_stat_clear_snapshot()");
                                        try(var rows=statement.executeQuery("select count(*) from pg_stat_activity where wait_event_type='Lock' and query ilike '%interviews%'")) {
                                            rows.next();reply=Map.of("waiting",rows.getLong(1));
                                        }
                                    }
                                }
                                case "release" -> {if(held!=null){held.rollback();held.close();held=null;}reply=Map.of("released",true);}
                                default -> throw new IllegalArgumentException("Unsupported test control");
                            }
                            Path replyPath=local.resolve("reply-"+id+".json"), staging=local.resolve("reply-"+id+".tmp");
                            mapper.writeValue(staging.toFile(),reply);Files.move(staging,replyPath,StandardCopyOption.ATOMIC_MOVE);
                        }
                        Thread.sleep(100);
                    }
                } finally {if(held!=null){held.rollback();held.close();}}
            }
        } finally {
            try(var paths=Files.walk(temporary)){for(Path path:paths.sorted(Comparator.reverseOrder()).toList())Files.deleteIfExists(path);}
        }
    }
    private static void recordOwnership(Path local,String runId,Path temporary,String containerId) throws Exception {
        var owner=new LinkedHashMap<String,Object>();
        owner.put("runId",runId);owner.put("temporaryRoot",temporary.toString());
        if(containerId!=null) owner.put("containerId",containerId);
        Path staging=local.resolve("ownership.tmp");
        new ObjectMapper().writeValue(staging.toFile(),owner);
        Files.move(staging,local.resolve("ownership.json"),StandardCopyOption.ATOMIC_MOVE,StandardCopyOption.REPLACE_EXISTING);
    }
    private static Map<String,Object> snapshot(JdbcTemplate jdbc) throws Exception {
        String rows=jdbc.queryForObject("select jsonb_agg(to_jsonb(a) order by id)::text from applications a",String.class);
        return Map.of("fixtureCounts",Map.of("users",jdbc.queryForObject("select count(*) from users",Long.class),
                        "companies",jdbc.queryForObject("select count(*) from companies",Long.class),"students",jdbc.queryForObject("select count(*) from students",Long.class),
                        "jobs",jdbc.queryForObject("select count(*) from jobs",Long.class),"savedCandidates",jdbc.queryForObject("select count(*) from saved_candidates",Long.class)),
                "migrationVersions",jdbc.queryForList("select version from flyway_schema_history where success and version is not null order by installed_rank",String.class),
                "postgresMajor",jdbc.queryForObject("select current_setting('server_version_num')::int/10000",Integer.class),
                "applicationDigest",HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(rows.getBytes(StandardCharsets.UTF_8))),
                "applicationCount",jdbc.queryForObject("select count(*) from applications",Long.class),
                "interviews",jdbc.queryForList("select id,company_id,student_id,job_id,status from interviews order by id"),
                "invitations",jdbc.queryForList("select id,company_id,student_id,job_id,status from job_invitations order by id"));
    }
}

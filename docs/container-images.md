# Container Images and GHCR Runbook

## Mục tiêu

Workflow `.github/workflows/container-images.yml` build hai image độc lập từ Dockerfile hiện có và publish lên GitHub Container Registry (GHCR) khi có push vào `master` hoặc push Git tag bắt đầu bằng `v`.

Pull request và `workflow_dispatch` chỉ build để kiểm tra; không đăng nhập registry và không push package.

## Image names

```text
ghcr.io/binkadev/student-job-recommendation-system-backend
ghcr.io/binkadev/student-job-recommendation-system-ai-service
```

## Tag policy

Mỗi lần publish luôn có tag bất biến theo full commit SHA:

```text
sha-<40-character-commit-sha>
```

Push vào `master` đồng thời cập nhật:

```text
latest
```

Git tag SemVer, ví dụ `v1.0.0`, tạo thêm:

```text
1.0.0
1.0
latest
sha-<40-character-commit-sha>
```

Không triển khai production chỉ dựa vào `latest`. Dùng tag SHA hoặc digest để có thể truy vết và rollback chính xác.

## Workflow permissions

Workflow chỉ yêu cầu:

```yaml
contents: read
packages: write
```

GHCR login dùng `GITHUB_TOKEN` tự sinh của workflow. Repository không cần lưu Personal Access Token hoặc registry password.

Các Docker actions bên thứ ba được pin bằng full commit SHA và có chú thích release version trong workflow.

## Build scope

| Image | Build context | Dockerfile | Platform |
|---|---|---|---|
| Backend | `./backend` | `./backend/Dockerfile` | `linux/amd64` |
| AI Service | `./ai-service` | `./ai-service/Dockerfile` | `linux/amd64` |

Hai image được build bằng matrix độc lập. Một image lỗi không che mất kết quả của image còn lại.

## Verification sau lần publish đầu tiên

1. Mở trang Packages của repository hoặc tài khoản `binkadev`.
2. Xác nhận có đủ hai package Backend và AI Service.
3. Xác nhận package liên kết với repository này.
4. Kiểm tra visibility phù hợp với môi trường sử dụng. GHCR package mới có thể cần được đổi visibility hoặc cấp quyền đọc trong phần Package settings.
5. Kiểm tra image có OCI labels `source`, `revision`, `version`, `title` và `description`.

## Pull theo commit SHA

```powershell
$sha = "<FULL_COMMIT_SHA>"

docker pull "ghcr.io/binkadev/student-job-recommendation-system-backend:sha-$sha"
docker pull "ghcr.io/binkadev/student-job-recommendation-system-ai-service:sha-$sha"
```

Với package private, đăng nhập bằng token có quyền `read:packages` trước khi pull:

```powershell
$env:CR_PAT | docker login ghcr.io -u binkadev --password-stdin
```

Không commit token vào repository hoặc `.env` được theo dõi bởi Git.

## Inspect digest và OCI labels

```powershell
$backendImage = "ghcr.io/binkadev/student-job-recommendation-system-backend:sha-<FULL_COMMIT_SHA>"
$aiImage = "ghcr.io/binkadev/student-job-recommendation-system-ai-service:sha-<FULL_COMMIT_SHA>"

docker pull $backendImage
docker pull $aiImage

docker image inspect $backendImage --format '{{json .RepoDigests}}'
docker image inspect $aiImage --format '{{json .RepoDigests}}'

docker image inspect $backendImage --format '{{json .Config.Labels}}'
docker image inspect $aiImage --format '{{json .Config.Labels}}'
```

Digest là tham chiếu bất biến mạnh nhất cho deployment cần tái lập tuyệt đối.

## Release tag

Sau khi commit trên `master` đã qua Backend CI, AI CI, container image build và acceptance smoke, tạo release tag:

```powershell
git switch master
git fetch origin --prune
git pull --ff-only origin master

git tag -a v1.0.0 -m "Student Job Recommendation System v1.0.0"
git push origin v1.0.0
```

Không tạo release tag từ feature branch hoặc working tree chưa sạch.

## Rollback

Rollback ứng dụng bằng cách chọn lại tag SHA đã biết là ổn định:

```powershell
$rollbackSha = "<KNOWN_GOOD_FULL_COMMIT_SHA>"

docker pull "ghcr.io/binkadev/student-job-recommendation-system-backend:sha-$rollbackSha"
docker pull "ghcr.io/binkadev/student-job-recommendation-system-ai-service:sha-$rollbackSha"
```

Sau đó cấu hình deployment hoặc Compose production dùng đúng hai tag SHA đó và restart service.

Rollback image không được đi kèm sửa hoặc xóa Flyway migration đã phát hành. Khi schema đã tiến về phía trước, phải kiểm tra compatibility của image cũ với schema hiện tại trước khi rollback Backend.

## Contract và nghiệp vụ không thay đổi

Container publishing không được thay đổi:

- kiến trúc `Frontend -> Backend -> AI Service` và `Backend -> PostgreSQL`;
- Contract V2 `/internal/v2/cv/parse` và `/internal/v2/recommendations`;
- algorithm/version/processing version;
- scoring 65/35 và cross-language fallback;
- Backend ownership của validation, sorting, `rankPosition` và persistence;
- bất kỳ business invariant hoặc Flyway migration nào.

## Acceptance cho PR container images

Trước khi merge:

- pull request build thành công cả Backend và AI image;
- pull request không login hoặc push GHCR;
- workflow chỉ thay đổi CI/container documentation;
- Dockerfiles hiện tại build thành công;
- không có secret mới;
- không có thay đổi source code, API, DTO, migration hoặc scoring.

Sau khi merge:

- push trên `master` publish đủ hai image;
- cả hai image có tag `sha-<full-commit-sha>`;
- `latest` chỉ là convenience tag, không phải rollback source of truth;
- pull và inspect image thành công;
- package visibility/access đã được xác nhận.

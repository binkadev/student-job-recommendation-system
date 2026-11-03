"""Generate extractable synthetic PDF/DOCX fixtures using only Python stdlib."""
from pathlib import Path
from xml.sax.saxutils import escape
from zipfile import ZipFile, ZIP_DEFLATED

folder = Path(__file__).parent / '.local'
folder.mkdir(exist_ok=True)
vi = [
    'NGUYỄN MINH KHOA — NHÂN VẬT TỔNG HỢP E2E',
    'Mục tiêu nghề nghiệp: Thực tập sinh lập trình Backend Java, Spring Boot.',
    'Tôi là sinh viên năm cuối ngành Công nghệ phần mềm, mong muốn xây dựng hệ thống quản lý có chất lượng.',
    'Học vấn: chương trình đại học giả định, giai đoạn 2022 đến 2026. Học lập trình hướng đối tượng, cơ sở dữ liệu và kiểm thử phần mềm.',
    'Kỹ năng chuyên môn: Java, Spring Boot, PostgreSQL, SQL, REST API, Git, Docker.',
    'Dự án học tập: xây dựng cổng thư viện sinh viên bằng Java và Spring Boot, lưu trữ bằng PostgreSQL.',
    'Tôi phụ trách phân quyền truy cập, thiết kế API tìm kiếm sách và viết kiểm thử cho các chức năng chính.',
    'Tôi phối hợp với nhóm bốn sinh viên, dùng Git để quản lý thay đổi, đọc tài liệu và đánh giá mã nguồn.',
    'Môi trường phát triển được đóng gói bằng Docker. Viết tài liệu cài đặt, kiểm tra dữ liệu nhập và xử lý lỗi.',
    'Chưa có kinh nghiệm làm việc chính thức. Mong muốn thực tập tại Thành phố Hồ Chí Minh với người hướng dẫn.',
]
en = [
    'NGUYEN MINH KHOA - SYNTHETIC E2E STUDENT',
    'Career objective: Backend Developer Intern or Fresher.',
    'Final-year software engineering student seeking a supervised internship in Ho Chi Minh City.',
    'Education: fictional undergraduate software engineering program, 2022 to 2026.',
    'Coursework: data structures, object-oriented programming, relational databases and software testing.',
    'Technical skills: Java, Spring Boot, PostgreSQL, SQL, REST API, Git, Docker.',
    'Project: student library portal implemented with Java, Spring Boot and PostgreSQL.',
    'Built authorization checks and book search endpoints, wrote controller tests and API documentation.',
    'Collaborated with four students using Git pull requests and code review.',
    'Packaged the development environment with Docker Compose and investigated validation failures.',
    'No professional employment history. Available for a mentored internship alongside final-year study.',
]

def docx(name, paragraphs):
    xml = ''.join(f'<w:p><w:r><w:t>{escape(p)}</w:t></w:r></w:p>' for p in paragraphs)
    with ZipFile(folder / name, 'w', ZIP_DEFLATED) as out:
        out.writestr('[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>')
        out.writestr('_rels/.rels', '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>')
        out.writestr('word/document.xml', f'<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>{xml}<w:sectPr/></w:body></w:document>')

def pdf(name, paragraphs):
    import textwrap
    lines = [line for p in paragraphs for line in textwrap.wrap(p, 88)]
    stream = 'BT /F1 11 Tf 40 800 Td 15 TL\n' + '\n'.join(f'({line.replace(chr(92), chr(92)*2).replace("(", chr(92)+"(").replace(")", chr(92)+")")}) Tj T*' for line in lines) + '\nET'
    objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', f'<< /Length {len(stream)} >>\nstream\n{stream}\nendstream']
    data = bytearray(b'%PDF-1.4\n')
    offsets = [0]
    for i, obj in enumerate(objects, 1):
        offsets.append(len(data))
        data.extend(f'{i} 0 obj\n{obj}\nendobj\n'.encode('ascii'))
    start = len(data)
    data.extend(f'xref\n0 {len(objects)+1}\n0000000000 65535 f \n'.encode())
    data.extend(''.join(f'{n:010d} 00000 n \n' for n in offsets[1:]).encode())
    data.extend(f'trailer\n<< /Size {len(objects)+1} /Root 1 0 R >>\nstartxref\n{start}\n%%EOF'.encode())
    (folder / name).write_bytes(data)

docx('datn-e2e-v1-khoa-vi.docx', vi)
pdf('datn-e2e-v1-khoa-en.pdf', en)
docx('datn-e2e-v1-frontend-en.docx', [p.replace('Java, Spring Boot, PostgreSQL, SQL, REST API, Git, Docker', 'React, TypeScript, JavaScript, HTML, CSS, Git').replace('NGUYEN MINH KHOA', 'TRAN AN E2E').replace('Backend', 'Frontend') for p in en])
docx('datn-e2e-v1-data-en.docx', [p.replace('Java, Spring Boot, PostgreSQL, SQL, REST API, Git, Docker', 'Python, SQL, PostgreSQL, Docker').replace('NGUYEN MINH KHOA', 'LE BINH E2E').replace('Backend', 'Data') for p in en])
docx('datn-e2e-v1-low-skills.docx', ['Education and experience. I am a final-year student with an interest in learning from a mentor. My previous projects were classroom presentations and written reports for study groups. I have no professional experience. Career objective: find a supervised internship where I can learn about work, communicate clearly, and contribute to a team. Skills: careful reading, listening and organising tasks. This is a fictional student.'])
(folder / 'invalid.txt').write_text('This is not an accepted CV format.', encoding='utf-8')
print('Generated six synthetic CV/negative fixtures (no credentials).')

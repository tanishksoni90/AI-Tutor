-- Create test student for API testing
-- Password: testpass123

INSERT INTO students (id, org_id, username, password_hash, email, first_name, last_name)
VALUES (
    '00000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000001',
    'teststudent',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYIxKTVz8je',  -- testpass123
    'test@example.com',
    'Test',
    'Student'
)
ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash;

-- Enroll student in test course
INSERT INTO enrollments (student_id, course_id)
VALUES (
    '00000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000002'
)
ON CONFLICT DO NOTHING;

-- Verify
SELECT 'Student created:' as info, username, email FROM students WHERE username = 'teststudent';

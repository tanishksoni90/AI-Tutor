-- Create test student for API testing
-- SAFETY: This script should only run in test environments
DO $$
BEGIN
    IF current_setting('app.environment', true) IS DISTINCT FROM 'test' 
       AND NOT coalesce(current_setting('is_test_env', true), 'false')::boolean THEN
        RAISE EXCEPTION 'This script can only run in test environment. Set app.environment=test or is_test_env=true';
    END IF;
END
$$;

INSERT INTO students (id, org_id, username, password_hash, email, first_name, last_name)
VALUES (
    '00000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000001',
    'teststudent',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYIxKTVz8je',
    'test@example.com',
    'Test',
    'Student'
)
ON CONFLICT (username) DO NOTHING;

-- Enroll student in test course
INSERT INTO enrollments (student_id, course_id)
VALUES (
    '00000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000002'
)
ON CONFLICT DO NOTHING;

-- Verify
SELECT 'Student created:' as info, username, email FROM students WHERE username = 'teststudent';

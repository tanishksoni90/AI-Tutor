-- Create test student for API testing
-- SECURITY: This script must only run in test/development environments

-- Environment guard: Abort if not in test environment
-- This requires setting a psql variable before running:
--   psql -v ALLOW_TEST_DATA=true -f create_test_student.sql
-- Or set APP_ENV to 'test' or 'development'
DO $$
BEGIN
    -- Check for ALLOW_TEST_DATA flag or test environment
    IF NOT (
        current_setting('app.allow_test_data', true) = 'true' OR
        current_setting('app.env', true) IN ('test', 'development') OR
        current_setting('server_version', true) LIKE '%test%'
    ) THEN
        RAISE EXCEPTION 'ABORTED: This script only runs in test environments. Set app.allow_test_data=true or app.env=test/development';
    END IF;
END $$;

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

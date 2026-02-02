-- Insert test data for ingestion testing

-- Insert test organization
INSERT INTO orgs (id, name) 
VALUES ('00000000-0000-0000-0000-000000000001', 'Test University')
ON CONFLICT DO NOTHING;

-- Insert test course
INSERT INTO courses (id, org_id, name, description)
VALUES (
    '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    'CS101: Introduction to AI',
    'Introduction to Artificial Intelligence and Machine Learning'
)
ON CONFLICT DO NOTHING;

-- Verify
SELECT 'Orgs:' as table_name, COUNT(*) as count FROM orgs
UNION ALL
SELECT 'Courses:', COUNT(*) FROM courses;

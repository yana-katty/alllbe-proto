-- E2E Testing用のテストデータ
-- 使い方: docker exec -i alllbe-postgres psql -U postgres -d alllbe_dev < test-data.sql

-- 1. テスト用Organization
INSERT INTO organizations (id, is_active, created_at, updated_at)
VALUES 
    ('test_org_001', TRUE, NOW(), NOW()),
    ('test_org_002', TRUE, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- 確認
SELECT 'Organizations created:' as message, COUNT(*) as count FROM organizations;
SELECT * FROM organizations;

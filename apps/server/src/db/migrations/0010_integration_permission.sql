-- @file   apps/server/src/db/migrations/0010_integration_permission.sql
-- @brief  The permission for the integration admin routes: identity providers, embed origins,
--         webhooks.
--
-- Responsibility: `integration.manage` for security admins (0001 names integrations among their
--                 tasks but granted no permission for them) and super_admin, which 0001 gave
--                 every permission of its time only. Bingo gates the same routes with it.
-- Spec:           docs/spec/07-integration.md §1; Bingo 05 §3 (Integrations)

INSERT INTO smg.role_permissions (role_id, permission) VALUES
    ('security_admin', 'integration.manage'), ('super_admin', 'integration.manage');

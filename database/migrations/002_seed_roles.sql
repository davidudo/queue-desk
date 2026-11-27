-- Seed canonical RBAC roles
INSERT INTO roles (name, description)
VALUES
  ('admin', 'Full platform administration, user management, and configuration access'),
  ('supervisor', 'Queue, tag, and agent management plus ticket escalation and audit access'),
  ('support_agent', 'Standard support workflow: create, triage, update, comment, and resolve tickets')
ON CONFLICT (name) DO NOTHING;

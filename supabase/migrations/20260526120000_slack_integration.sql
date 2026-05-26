-- Slack Integration
-- Adds an index for looking up workspaces by Slack team ID during event handling.

CREATE INDEX IF NOT EXISTS idx_integrations_slack_team_id
  ON integrations ((config->>'slack_team_id'))
  WHERE platform = 'slack';

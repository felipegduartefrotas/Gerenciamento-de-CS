-- Migration: adiciona coluna clickup_task_id na tabela acoes
-- Armazena o ID da tarefa correspondente no ClickUp para sincronização bidirecional
ALTER TABLE acoes ADD COLUMN IF NOT EXISTS clickup_task_id TEXT;
CREATE INDEX IF NOT EXISTS idx_acoes_clickup ON acoes(clickup_task_id) WHERE clickup_task_id IS NOT NULL;

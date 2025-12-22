-- Caption edits tracking for reinforcement learning
-- Stores AI-generated vs user-edited captions to learn from patterns

CREATE TABLE IF NOT EXISTS caption_edits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES event_discovery(id) ON DELETE CASCADE,
  source_account TEXT NOT NULL,
  original_caption TEXT,
  ai_caption TEXT NOT NULL,
  user_edited_caption TEXT NOT NULL,
  context_used TEXT,
  edit_distance INTEGER, -- Levenshtein distance (how much was changed)
  was_significant_edit BOOLEAN DEFAULT false, -- True if >20% changed
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for querying recent edits for learning
CREATE INDEX idx_caption_edits_created ON caption_edits(created_at DESC);
CREATE INDEX idx_caption_edits_significant ON caption_edits(was_significant_edit) WHERE was_significant_edit = true;

-- RLS
ALTER TABLE caption_edits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations" ON caption_edits FOR ALL USING (true) WITH CHECK (true);


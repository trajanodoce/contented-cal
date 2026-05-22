/*
  # Add status tracking to intake_submissions

  Adds review workflow columns to intake_submissions:
  - status: 'pending' | 'converted' | 'rejected' (default 'pending')
  - reviewed_by: user ID of the reviewer
  - reviewed_at: timestamp of review
  - submitted_at: alias for created_at for clarity in queries
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'intake_submissions' AND column_name = 'status'
  ) THEN
    ALTER TABLE intake_submissions ADD COLUMN status text NOT NULL DEFAULT 'pending'
      CHECK (status IN ('pending', 'converted', 'rejected'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'intake_submissions' AND column_name = 'reviewed_by'
  ) THEN
    ALTER TABLE intake_submissions ADD COLUMN reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'intake_submissions' AND column_name = 'reviewed_at'
  ) THEN
    ALTER TABLE intake_submissions ADD COLUMN reviewed_at timestamptz;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_intake_submissions_status ON intake_submissions(status);

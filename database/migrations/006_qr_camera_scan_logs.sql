-- ============================================================================
-- PENERIMAAN SANTRI BARU (PSB) PPTQM DARUL HIKMAH TP 2027/2028
-- Database Migration 006: QR Camera Scan Logs & Attendance Tracking
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. ADD SCAN COLUMNS TO test_schedule_participants (if not exists)
-- ----------------------------------------------------------------------------
ALTER TABLE public.test_schedule_participants
ADD COLUMN IF NOT EXISTS scanned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS scanned_by_name TEXT,
ADD COLUMN IF NOT EXISTS scanned_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS scan_method VARCHAR(30) DEFAULT 'MANUAL',
ADD COLUMN IF NOT EXISTS qr_token VARCHAR(64);

-- ----------------------------------------------------------------------------
-- 2. TABLE: candidate_qr_scan_logs
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.candidate_qr_scan_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID REFERENCES public.candidates(id) ON DELETE SET NULL,
    candidate_name TEXT,
    registration_number VARCHAR(30),
    token_id UUID REFERENCES public.candidate_verification_tokens(id) ON DELETE SET NULL,
    schedule_id UUID REFERENCES public.test_schedules(id) ON DELETE SET NULL,
    schedule_title TEXT,
    scanned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    scanned_by_name TEXT,
    scan_method VARCHAR(30) NOT NULL CHECK (scan_method IN ('QR_CAMERA', 'MANUAL')),
    scan_result VARCHAR(40) NOT NULL CHECK (scan_result IN ('SUCCESS', 'SUCCESS_ALREADY_PRESENT', 'INVALID_TOKEN', 'NOT_FOUND', 'EXPIRED', 'NOT_ELIGIBLE', 'ERROR')),
    scanned_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Indexes for lightning fast lookups & audit logs
CREATE INDEX IF NOT EXISTS idx_qr_scan_logs_candidate ON public.candidate_qr_scan_logs(candidate_id);
CREATE INDEX IF NOT EXISTS idx_qr_scan_logs_schedule ON public.candidate_qr_scan_logs(schedule_id);
CREATE INDEX IF NOT EXISTS idx_qr_scan_logs_method ON public.candidate_qr_scan_logs(scan_method);
CREATE INDEX IF NOT EXISTS idx_qr_scan_logs_result ON public.candidate_qr_scan_logs(scan_result);
CREATE INDEX IF NOT EXISTS idx_qr_scan_logs_scanned_at ON public.candidate_qr_scan_logs(scanned_at DESC);

-- ----------------------------------------------------------------------------
-- 3. ROW LEVEL SECURITY (RLS) POLICIES
-- ----------------------------------------------------------------------------
ALTER TABLE public.candidate_qr_scan_logs ENABLE ROW LEVEL SECURITY;

-- Staff & Panitia can read all scan logs
CREATE POLICY "Staff view qr scan logs"
    ON public.candidate_qr_scan_logs FOR SELECT
    USING (public.get_current_user_role() IN ('SUPER_ADMIN', 'PANITIA', 'PENGUJI_QURAN', 'PIMPINAN'));

-- Staff & Panitia can insert scan logs
CREATE POLICY "Staff insert qr scan logs"
    ON public.candidate_qr_scan_logs FOR INSERT
    WITH CHECK (public.get_current_user_role() IN ('SUPER_ADMIN', 'PANITIA', 'PENGUJI_QURAN', 'PIMPINAN'));

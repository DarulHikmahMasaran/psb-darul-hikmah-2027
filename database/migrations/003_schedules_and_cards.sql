-- ============================================================================
-- PENERIMAAN SANTRI BARU (PSB) PPTQM DARUL HIKMAH TP 2027/2028
-- Database Migration 003: Selection Schedules, Participant Assignment & Exam Cards
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. TABLE: test_types (Jenis Seleksi: AKADEMIK, QURAN, PSIKOTES)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.test_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Seed initial test types
INSERT INTO public.test_types (code, name, description, is_active, sort_order)
VALUES
    (
        'AKADEMIK',
        'Tes Potensi Akademik',
        'Ujian tertulis materi Matematika Dasar, IPA Terpadu, Bahasa Indonesia, dan Pendidikan Agama Islam.',
        true,
        1
    ),
    (
        'QURAN',
        'Tes Al-Qur''an (Tahfidz & Tajwid)',
        'Uji kelancaran membaca Al-Qur''an (fashahah & tartil), makharijul huruf, kaidah tajwid, dan setoran hafalan juz 30.',
        true,
        2
    ),
    (
        'PSIKOTES',
        'Psikotes & Wawancara Santri/Wali',
        'Asesmen kemandirian santri, psikotes minat bakat, wawancara kesiapan mondok santri dan komitmen orang tua/wali.',
        true,
        3
    )
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    description = EXCLUDED.description,
    is_active = EXCLUDED.is_active,
    sort_order = EXCLUDED.sort_order,
    updated_at = timezone('utc'::text, now());

-- ----------------------------------------------------------------------------
-- 2. TABLE: test_schedules (Sesi Jadwal Seleksi)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.test_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_type_id UUID NOT NULL REFERENCES public.test_types(id) ON DELETE RESTRICT,
    title TEXT NOT NULL,
    test_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    location TEXT NOT NULL,
    room TEXT NOT NULL,
    online_url TEXT,
    capacity INTEGER NOT NULL CHECK (capacity > 0),
    notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Indexes for schedule searches
CREATE INDEX IF NOT EXISTS idx_test_schedules_type ON public.test_schedules(test_type_id);
CREATE INDEX IF NOT EXISTS idx_test_schedules_date ON public.test_schedules(test_date);
CREATE INDEX IF NOT EXISTS idx_test_schedules_active ON public.test_schedules(is_active);

-- ----------------------------------------------------------------------------
-- 3. TABLE: test_schedule_participants (Penempatan Peserta pada Jadwal)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.test_schedule_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_id UUID NOT NULL REFERENCES public.test_schedules(id) ON DELETE CASCADE,
    candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
    seat_number VARCHAR(20) NOT NULL,
    attendance_status VARCHAR(20) NOT NULL DEFAULT 'BELUM_HADIR' CHECK (attendance_status IN ('BELUM_HADIR', 'HADIR', 'TERLAMBAT', 'TIDAK_HADIR')),
    attendance_note TEXT,
    assigned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_test_schedule_candidate UNIQUE (schedule_id, candidate_id),
    CONSTRAINT uq_test_schedule_seat UNIQUE (schedule_id, seat_number)
);

-- Indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_schedule_participants_schedule ON public.test_schedule_participants(schedule_id);
CREATE INDEX IF NOT EXISTS idx_schedule_participants_candidate ON public.test_schedule_participants(candidate_id);
CREATE INDEX IF NOT EXISTS idx_schedule_participants_attendance ON public.test_schedule_participants(attendance_status);

-- ----------------------------------------------------------------------------
-- 4. TABLE: candidate_verification_tokens (QR Code Verification Token)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.candidate_verification_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    expires_at TIMESTAMPTZ,
    last_used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_tokens_candidate ON public.candidate_verification_tokens(candidate_id);
CREATE INDEX IF NOT EXISTS idx_tokens_hash ON public.candidate_verification_tokens(token_hash);

-- ----------------------------------------------------------------------------
-- 5. TABLE: candidate_notifications (Notifikasi Jadwal & Pengumuman)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.candidate_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'SCHEDULE_UPDATE',
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_notifications_candidate ON public.candidate_notifications(candidate_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON public.candidate_notifications(candidate_id, is_read);

-- ----------------------------------------------------------------------------
-- 6. TRIGGERS: auto update timestamp
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_test_types_updated_at ON public.test_types;
CREATE TRIGGER trg_test_types_updated_at
BEFORE UPDATE ON public.test_types
FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

DROP TRIGGER IF EXISTS trg_test_schedules_updated_at ON public.test_schedules;
CREATE TRIGGER trg_test_schedules_updated_at
BEFORE UPDATE ON public.test_schedules
FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

DROP TRIGGER IF EXISTS trg_test_schedule_participants_updated_at ON public.test_schedule_participants;
CREATE TRIGGER trg_test_schedule_participants_updated_at
BEFORE UPDATE ON public.test_schedule_participants
FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

-- ----------------------------------------------------------------------------
-- 7. ROW LEVEL SECURITY (RLS) POLICIES
-- ----------------------------------------------------------------------------
ALTER TABLE public.test_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_schedule_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_verification_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_notifications ENABLE ROW LEVEL SECURITY;

-- 7.1 TEST_TYPES POLICIES
CREATE POLICY "Public read active test types"
    ON public.test_types FOR SELECT
    USING (is_active = true);

CREATE POLICY "Staff manage test types"
    ON public.test_types FOR ALL
    USING (public.get_current_user_role() IN ('SUPER_ADMIN', 'PANITIA'));

-- 7.2 TEST_SCHEDULES POLICIES
CREATE POLICY "Authenticated read active schedules"
    ON public.test_schedules FOR SELECT
    TO authenticated
    USING (is_active = true OR public.get_current_user_role() IN ('SUPER_ADMIN', 'PANITIA', 'PENGUJI_QURAN', 'PIMPINAN'));

CREATE POLICY "Staff manage schedules"
    ON public.test_schedules FOR ALL
    USING (public.get_current_user_role() IN ('SUPER_ADMIN', 'PANITIA'));

-- 7.3 TEST_SCHEDULE_PARTICIPANTS POLICIES
-- Peserta can ONLY view their own assigned sessions
CREATE POLICY "Peserta view own scheduled sessions"
    ON public.test_schedule_participants FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.candidates
            WHERE candidates.id = test_schedule_participants.candidate_id
              AND candidates.user_id = auth.uid()
        )
    );

-- Staff can view all participants across all sessions
CREATE POLICY "Staff view all schedule participants"
    ON public.test_schedule_participants FOR SELECT
    USING (public.get_current_user_role() IN ('SUPER_ADMIN', 'PANITIA', 'PENGUJI_QURAN', 'PIMPINAN'));

-- Only Panitia and Super Admin can assign or remove participants
CREATE POLICY "Staff manage schedule participants"
    ON public.test_schedule_participants FOR ALL
    USING (public.get_current_user_role() IN ('SUPER_ADMIN', 'PANITIA'));

-- 7.4 CANDIDATE_VERIFICATION_TOKENS POLICIES
CREATE POLICY "Peserta view own verification token"
    ON public.candidate_verification_tokens FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.candidates
            WHERE candidates.id = candidate_verification_tokens.candidate_id
              AND candidates.user_id = auth.uid()
        )
    );

CREATE POLICY "Staff view all verification tokens"
    ON public.candidate_verification_tokens FOR SELECT
    USING (public.get_current_user_role() IN ('SUPER_ADMIN', 'PANITIA', 'PENGUJI_QURAN', 'PIMPINAN'));

CREATE POLICY "Staff manage verification tokens"
    ON public.candidate_verification_tokens FOR ALL
    USING (public.get_current_user_role() IN ('SUPER_ADMIN', 'PANITIA'));

-- 7.5 CANDIDATE_NOTIFICATIONS POLICIES
CREATE POLICY "Peserta view own notifications"
    ON public.candidate_notifications FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.candidates
            WHERE candidates.id = candidate_notifications.candidate_id
              AND candidates.user_id = auth.uid()
        )
    );

CREATE POLICY "Peserta update read status own notifications"
    ON public.candidate_notifications FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.candidates
            WHERE candidates.id = candidate_notifications.candidate_id
              AND candidates.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.candidates
            WHERE candidates.id = candidate_notifications.candidate_id
              AND candidates.user_id = auth.uid()
        )
    );

CREATE POLICY "Staff insert notifications"
    ON public.candidate_notifications FOR INSERT
    WITH CHECK (public.get_current_user_role() IN ('SUPER_ADMIN', 'PANITIA'));

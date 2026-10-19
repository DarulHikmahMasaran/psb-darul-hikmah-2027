import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { getStorageData, saveStorageData } from '../lib/storage';
import {
  TestType,
  TestSchedule,
  TestScheduleParticipant,
  AttendanceStatus,
  CandidateVerificationToken,
  CandidateNotification,
  Candidate,
  CandidateQrScanLog,
  QrScanMethod,
  QrScanResult
} from '../types/database';
import { auditService } from './auditService';
import { documentService } from './documentService';

export interface CreateSchedulePayload {
  test_type_id: string;
  title: string;
  test_date: string;
  start_time: string;
  end_time: string;
  location: string;
  room: string;
  online_url?: string;
  capacity: number;
  notes?: string;
}

export interface CandidateVerifiedQrResult {
  candidate: {
    id: string;
    registration_number: string;
    full_name: string;
    nisn?: string;
    school_name?: string;
    status: string;
    gender?: 'L' | 'P';
  };
  photoUrl?: string | null;
  verificationToken?: string;
  isTokenValid: boolean;
  isVerifiedEligible: boolean;
  alreadyPresent?: boolean;
  alreadyPresentDetails?: {
    sessionTitle?: string;
    scannedAt?: string;
    scannedByName?: string;
    status?: AttendanceStatus;
  };
  schedules: Array<{
    participantId: string;
    scheduleId: string;
    testTypeName: string;
    testTypeCode: string;
    title: string;
    test_date: string;
    start_time: string;
    end_time: string;
    location: string;
    room: string;
    seat_number: string;
    attendance_status: AttendanceStatus;
    attendance_note?: string;
    scanned_at?: string;
    scanned_by_name?: string;
  }>;
}

export const scheduleService = {
  // 1. Get Test Types (AKADEMIK, QURAN, PSIKOTES)
  async getTestTypes(): Promise<TestType[]> {
    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase
          .from('test_types')
          .select('*')
          .eq('is_active', true)
          .order('sort_order', { ascending: true });

        if (!error && data && data.length > 0) {
          return data as TestType[];
        }
      } catch (err) {
        console.error('Supabase getTestTypes error', err);
      }
    }

    const data = getStorageData();
    return data.testTypes.filter((t) => t.is_active).sort((a, b) => a.sort_order - b.sort_order);
  },

  // 2. Get All Schedules with participant counts
  async getSchedules(params?: { testTypeId?: string; date?: string; activeOnly?: boolean }): Promise<TestSchedule[]> {
    const data = getStorageData();
    let schedules: TestSchedule[] = [];

    if (isSupabaseConfigured() && supabase) {
      try {
        let query = supabase.from('test_schedules').select('*, test_type:test_types(*)');
        if (params?.testTypeId) query = query.eq('test_type_id', params.testTypeId);
        if (params?.date) query = query.eq('test_date', params.date);
        if (params?.activeOnly) query = query.eq('is_active', true);
        query = query.order('test_date', { ascending: true }).order('start_time', { ascending: true });

        const { data: dbData, error } = await query;
        if (!error && dbData) {
          schedules = dbData as TestSchedule[];
        }
      } catch (err) {
        console.error('Supabase getSchedules error', err);
      }
    }

    if (schedules.length === 0) {
      schedules = [...data.testSchedules];
      if (params?.testTypeId) {
        schedules = schedules.filter((s) => s.test_type_id === params.testTypeId);
      }
      if (params?.date) {
        schedules = schedules.filter((s) => s.test_date === params.date);
      }
      if (params?.activeOnly) {
        schedules = schedules.filter((s) => s.is_active);
      }
      schedules.sort((a, b) => {
        if (a.test_date !== b.test_date) return a.test_date.localeCompare(b.test_date);
        return a.start_time.localeCompare(b.start_time);
      });
    }

    // Attach participant counts & test type objects
    return schedules.map((sch) => {
      const type = data.testTypes.find((t) => t.id === sch.test_type_id) || sch.test_type;
      const count = data.testScheduleParticipants.filter((p) => p.schedule_id === sch.id).length;
      return {
        ...sch,
        test_type: type,
        participant_count: count,
      };
    });
  },

  // 3. Get single schedule by ID
  async getScheduleById(id: string): Promise<TestSchedule | null> {
    const schedules = await this.getSchedules();
    return schedules.find((s) => s.id === id) || null;
  },

  // 4. Create Schedule
  async createSchedule(
    payload: CreateSchedulePayload,
    user: { id: string; email: string; name: string }
  ): Promise<{ success: boolean; schedule?: TestSchedule; error?: string }> {
    // Validations
    if (!payload.title?.trim()) {
      return { success: false, error: 'Judul sesi seleksi wajib diisi.' };
    }
    if (!payload.test_date) {
      return { success: false, error: 'Tanggal pelaksanaan ujian wajib diisi.' };
    }
    if (!payload.start_time || !payload.end_time) {
      return { success: false, error: 'Jam mulai dan jam selesai wajib diisi.' };
    }
    if (payload.start_time >= payload.end_time) {
      return { success: false, error: 'Jam selesai harus lebih akhir dari jam mulai ujian.' };
    }
    if (!payload.capacity || payload.capacity <= 0) {
      return { success: false, error: 'Kapasitas peserta minimal 1 orang.' };
    }
    if (!payload.location?.trim() || !payload.room?.trim()) {
      return { success: false, error: 'Lokasi dan nama ruangan seleksi wajib diisi.' };
    }

    const data = getStorageData();
    const type = data.testTypes.find((t) => t.id === payload.test_type_id);
    if (!type) {
      return { success: false, error: 'Jenis tes yang dipilih tidak valid.' };
    }

    const schId = `sch-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const newSchedule: TestSchedule = {
      id: schId,
      test_type_id: payload.test_type_id,
      test_type: type,
      title: payload.title.trim(),
      test_date: payload.test_date,
      start_time: payload.start_time,
      end_time: payload.end_time,
      location: payload.location.trim(),
      room: payload.room.trim(),
      online_url: payload.online_url?.trim() || undefined,
      capacity: Number(payload.capacity),
      notes: payload.notes?.trim() || undefined,
      is_active: true,
      participant_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (isSupabaseConfigured() && supabase) {
      try {
        const { data: inserted, error: dbErr } = await supabase
          .from('test_schedules')
          .insert({
            test_type_id: payload.test_type_id,
            title: newSchedule.title,
            test_date: newSchedule.test_date,
            start_time: newSchedule.start_time,
            end_time: newSchedule.end_time,
            location: newSchedule.location,
            room: newSchedule.room,
            online_url: newSchedule.online_url,
            capacity: newSchedule.capacity,
            notes: newSchedule.notes,
            is_active: true,
          })
          .select()
          .single();

        if (!dbErr && inserted) {
          newSchedule.id = inserted.id;
        }
      } catch (err) {
        console.error('Supabase createSchedule error', err);
      }
    }

    data.testSchedules.push(newSchedule);
    saveStorageData(data);

    await auditService.logAction({
      userId: user.id,
      userEmail: user.email,
      action: 'SCHEDULE_CREATED',
      entityType: 'TEST_SCHEDULE',
      entityId: newSchedule.id,
      newValue: {
        title: newSchedule.title,
        date: newSchedule.test_date,
        capacity: newSchedule.capacity,
        type: type.code,
      },
    });

    return { success: true, schedule: newSchedule };
  },

  // 5. Update Schedule
  async updateSchedule(
    id: string,
    payload: Partial<CreateSchedulePayload> & { is_active?: boolean },
    user: { id: string; email: string; name: string }
  ): Promise<{ success: boolean; error?: string }> {
    const data = getStorageData();
    const idx = data.testSchedules.findIndex((s) => s.id === id);
    if (idx === -1) {
      return { success: false, error: 'Sesi jadwal seleksi tidak ditemukan.' };
    }

    const current = data.testSchedules[idx];
    const currentAssignedCount = data.testScheduleParticipants.filter((p) => p.schedule_id === id).length;

    if (payload.capacity !== undefined && payload.capacity < currentAssignedCount) {
      return {
        success: false,
        error: `Kapasitas tidak boleh lebih kecil dari jumlah peserta yang telah terdaftar (${currentAssignedCount} orang).`,
      };
    }

    if (payload.start_time && payload.end_time && payload.start_time >= payload.end_time) {
      return { success: false, error: 'Jam selesai harus lebih akhir dari jam mulai.' };
    }

    const updated: TestSchedule = {
      ...current,
      ...payload,
      updated_at: new Date().toISOString(),
    };

    if (payload.test_type_id) {
      const type = data.testTypes.find((t) => t.id === payload.test_type_id);
      if (type) updated.test_type = type;
    }

    data.testSchedules[idx] = updated;
    saveStorageData(data);

    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase
          .from('test_schedules')
          .update({
            ...payload,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id);
      } catch (err) {
        console.error('Supabase updateSchedule error', err);
      }
    }

    await auditService.logAction({
      userId: user.id,
      userEmail: user.email,
      action: 'SCHEDULE_UPDATED',
      entityType: 'TEST_SCHEDULE',
      entityId: id,
      oldValue: { title: current.title, capacity: current.capacity, is_active: current.is_active },
      newValue: payload,
    });

    return { success: true };
  },

  // 6. Delete Schedule (Only if no participants assigned)
  async deleteSchedule(
    id: string,
    user: { id: string; email: string }
  ): Promise<{ success: boolean; error?: string }> {
    const data = getStorageData();
    const idx = data.testSchedules.findIndex((s) => s.id === id);
    if (idx === -1) {
      return { success: false, error: 'Jadwal tidak ditemukan.' };
    }

    const assignedCount = data.testScheduleParticipants.filter((p) => p.schedule_id === id).length;
    if (assignedCount > 0) {
      return {
        success: false,
        error: `Jadwal ini tidak dapat dihapus karena sudah memiliki ${assignedCount} peserta terdaftar. Silakan pindahkan atau hapus peserta terlebih dahulu.`,
      };
    }

    const removed = data.testSchedules.splice(idx, 1)[0];
    saveStorageData(data);

    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase.from('test_schedules').delete().eq('id', id);
      } catch (err) {
        console.error('Supabase deleteSchedule error', err);
      }
    }

    await auditService.logAction({
      userId: user.id,
      userEmail: user.email,
      action: 'SCHEDULE_DELETED',
      entityType: 'TEST_SCHEDULE',
      entityId: id,
      oldValue: { title: removed.title, date: removed.test_date },
    });

    return { success: true };
  },

  // 7. Get Participants for a Schedule
  async getScheduleParticipants(scheduleId: string): Promise<TestScheduleParticipant[]> {
    const data = getStorageData();
    let participants: TestScheduleParticipant[] = [];

    if (isSupabaseConfigured() && supabase) {
      try {
        const { data: dbData, error } = await supabase
          .from('test_schedule_participants')
          .select('*, candidate:candidates(*)')
          .eq('schedule_id', scheduleId)
          .order('seat_number', { ascending: true });

        if (!error && dbData) {
          participants = dbData as TestScheduleParticipant[];
        }
      } catch (err) {
        console.error('Supabase getScheduleParticipants error', err);
      }
    }

    if (participants.length === 0) {
      participants = data.testScheduleParticipants
        .filter((p) => p.schedule_id === scheduleId)
        .map((p) => {
          const cand = data.candidates.find((c) => c.id === p.candidate_id);
          return {
            ...p,
            candidate: cand,
          };
        });
    }

    // Sort by seat number
    return participants.sort((a, b) => a.seat_number.localeCompare(b.seat_number, undefined, { numeric: true }));
  },

  // 8. Assign Participants to Schedule
  async assignParticipants(params: {
    scheduleId: string;
    candidateIds: string[];
    assignedBy: string;
    assignedByName: string;
    assignedByEmail: string;
  }): Promise<{ success: boolean; assignedCount: number; error?: string }> {
    const data = getStorageData();
    const schedule = data.testSchedules.find((s) => s.id === params.scheduleId);
    if (!schedule) {
      return { success: false, assignedCount: 0, error: 'Sesi seleksi tidak ditemukan.' };
    }

    const currentParticipants = data.testScheduleParticipants.filter((p) => p.schedule_id === params.scheduleId);
    const availableSlots = schedule.capacity - currentParticipants.length;

    if (availableSlots <= 0) {
      return {
        success: false,
        assignedCount: 0,
        error: `Kapasitas sesi "${schedule.title}" sudah penuh (${schedule.capacity} peserta).`,
      };
    }

    // Filter candidate IDs:
    // 1. Must exist
    // 2. Status must be TERVERIFIKASI or later
    // 3. Must not already be in this schedule
    const eligibleCandidates: Candidate[] = [];
    const existingCandidateIds = new Set(currentParticipants.map((p) => p.candidate_id));

    for (const candId of params.candidateIds) {
      if (existingCandidateIds.has(candId)) continue;
      const cand = data.candidates.find((c) => c.id === candId);
      if (!cand) continue;

      const allowedStatuses = [
        'TERVERIFIKASI',
        'DIIZINKAN_MENGIKUTI_SELEKSI',
        'MENGIKUTI_SELEKSI',
        'SELESAI_SELEKSI',
      ];
      if (allowedStatuses.includes(cand.status)) {
        eligibleCandidates.push(cand);
      }
    }

    if (eligibleCandidates.length === 0) {
      return {
        success: false,
        assignedCount: 0,
        error: 'Tidak ada kandidat terpilih yang berstatus TERVERIFIKASI atau belum terdaftar di sesi ini.',
      };
    }

    // Capacity limit check: cannot exceed available slots
    if (eligibleCandidates.length > availableSlots) {
      return {
        success: false,
        assignedCount: 0,
        error: `Anda memilih ${eligibleCandidates.length} peserta, namun sisa kuota sesi ini hanya ${availableSlots} kursi. Harap kurangi jumlah pilihan peserta.`,
      };
    }

    // Determine prefix for seat numbering
    const type = data.testTypes.find((t) => t.id === schedule.test_type_id);
    const prefix = type ? type.code.charAt(0) : 'S';

    // Find highest used seat number index
    let nextSeatIndex = 1;
    const existingNumbers = currentParticipants
      .map((p) => {
        const num = parseInt(p.seat_number.replace(/\D/g, ''));
        return isNaN(num) ? 0 : num;
      })
      .sort((a, b) => b - a);

    if (existingNumbers.length > 0 && existingNumbers[0] > 0) {
      nextSeatIndex = existingNumbers[0] + 1;
    }

    let addedCount = 0;
    for (const cand of eligibleCandidates) {
      const seatNo = `${prefix}-${String(nextSeatIndex).padStart(2, '0')}`;
      nextSeatIndex++;

      const newParticipant: TestScheduleParticipant = {
        id: `tsp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        schedule_id: params.scheduleId,
        candidate_id: cand.id,
        seat_number: seatNo,
        attendance_status: 'BELUM_HADIR',
        assigned_by: params.assignedBy,
        assigned_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      data.testScheduleParticipants.push(newParticipant);

      // Create in-app notification for candidate
      data.notifications.push({
        id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        candidate_id: cand.id,
        title: `Jadwal ${schedule.title} Ditetapkan`,
        message: `Anda telah dijadwalkan mengikuti ${schedule.title} pada ${schedule.test_date} pukul ${schedule.start_time} - ${schedule.end_time} di ${schedule.room} (${schedule.location}). Nomor Kursi Anda: ${seatNo}.`,
        type: 'SCHEDULE_ASSIGNED',
        is_read: false,
        created_at: new Date().toISOString(),
      });

      // Update candidate status to DIIZINKAN_MENGIKUTI_SELEKSI if currently TERVERIFIKASI
      if (cand.status === 'TERVERIFIKASI') {
        cand.status = 'DIIZINKAN_MENGIKUTI_SELEKSI';
        cand.updated_at = new Date().toISOString();
        data.statusHistory.unshift({
          id: `hist-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          candidate_id: cand.id,
          old_status: 'TERVERIFIKASI',
          new_status: 'DIIZINKAN_MENGIKUTI_SELEKSI',
          changed_by: params.assignedBy,
          changed_by_name: params.assignedByName,
          note: `Peserta dijadwalkan pada sesi ${schedule.title} (No. Kursi ${seatNo}).`,
          created_at: new Date().toISOString(),
        });
      }

      addedCount++;
    }

    saveStorageData(data);

    await auditService.logAction({
      userId: params.assignedBy,
      userEmail: params.assignedByEmail,
      action: 'PARTICIPANT_ASSIGNED',
      entityType: 'TEST_SCHEDULE',
      entityId: params.scheduleId,
      newValue: {
        session: schedule.title,
        assignedCount: addedCount,
        candidateIds: eligibleCandidates.map((c) => c.id),
      },
    });

    return { success: true, assignedCount: addedCount };
  },

  // 9. Remove Participant from Schedule
  async removeParticipant(
    scheduleId: string,
    candidateId: string,
    user: { id: string; email: string; name: string }
  ): Promise<{ success: boolean; error?: string }> {
    const data = getStorageData();
    const idx = data.testScheduleParticipants.findIndex(
      (p) => p.schedule_id === scheduleId && p.candidate_id === candidateId
    );
    if (idx === -1) {
      return { success: false, error: 'Peserta tidak ditemukan pada sesi ini.' };
    }

    const removed = data.testScheduleParticipants.splice(idx, 1)[0];
    const sch = data.testSchedules.find((s) => s.id === scheduleId);

    // Add cancellation notification
    data.notifications.push({
      id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      candidate_id: candidateId,
      title: 'Perubahan Jadwal Seleksi',
      message: `Penempatan Anda pada sesi ${sch?.title || 'Seleksi'} telah dibatalkan oleh panitia. Jadwal baru akan segera diperbarui.`,
      type: 'SCHEDULE_CANCELLED',
      is_read: false,
      created_at: new Date().toISOString(),
    });

    saveStorageData(data);

    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase
          .from('test_schedule_participants')
          .delete()
          .eq('schedule_id', scheduleId)
          .eq('candidate_id', candidateId);
      } catch (err) {
        console.error('Supabase removeParticipant error', err);
      }
    }

    await auditService.logAction({
      userId: user.id,
      userEmail: user.email,
      action: 'PARTICIPANT_REMOVED',
      entityType: 'TEST_SCHEDULE',
      entityId: scheduleId,
      oldValue: { candidate_id: candidateId, seat_number: removed.seat_number },
    });

    return { success: true };
  },

  // 10. Update Attendance Status
  async updateAttendance(params: {
    scheduleId: string;
    candidateId: string;
    status: AttendanceStatus;
    note?: string;
    scanMethod?: QrScanMethod;
    qrToken?: string;
    deviceInfo?: Record<string, any>;
    user: { id: string; email: string; name: string };
  }): Promise<{ success: boolean; error?: string }> {
    const data = getStorageData();
    const item = data.testScheduleParticipants.find(
      (p) => p.schedule_id === params.scheduleId && p.candidate_id === params.candidateId
    );
    if (!item) {
      return { success: false, error: 'Peserta tidak terdaftar pada sesi jadwal ini.' };
    }

    const oldStatus = item.attendance_status;
    const nowIso = new Date().toISOString();
    item.attendance_status = params.status;
    item.attendance_note = params.note?.trim() || undefined;
    item.scanned_by = params.user.id;
    item.scanned_by_name = params.user.name;
    item.scanned_at = nowIso;
    item.scan_method = params.scanMethod || 'MANUAL';
    if (params.qrToken) item.qr_token = params.qrToken;
    item.updated_at = nowIso;

    // If attendance is HADIR, update candidate status to MENGIKUTI_SELEKSI
    const cand = data.candidates.find((c) => c.id === params.candidateId);
    if (cand && params.status === 'HADIR' && cand.status === 'DIIZINKAN_MENGIKUTI_SELEKSI') {
      cand.status = 'MENGIKUTI_SELEKSI';
      cand.updated_at = nowIso;
      data.statusHistory.unshift({
        id: `hist-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        candidate_id: cand.id,
        old_status: 'DIIZINKAN_MENGIKUTI_SELEKSI',
        new_status: 'MENGIKUTI_SELEKSI',
        changed_by: params.user.id,
        changed_by_name: params.user.name,
        note: `Presensi kehadiran terverifikasi (${params.status}).`,
        created_at: nowIso,
      });
    }

    saveStorageData(data);

    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase
          .from('test_schedule_participants')
          .update({
            attendance_status: params.status,
            attendance_note: item.attendance_note,
            scanned_by: params.user.id,
            scanned_by_name: params.user.name,
            scanned_at: nowIso,
            scan_method: params.scanMethod || 'MANUAL',
            qr_token: params.qrToken,
            updated_at: nowIso,
          })
          .eq('schedule_id', params.scheduleId)
          .eq('candidate_id', params.candidateId);
      } catch (err) {
        console.error('Supabase updateAttendance error', err);
      }
    }

    const sch = data.testSchedules.find((s) => s.id === params.scheduleId);

    // Record scan log
    await this.recordScanLog({
      candidateId: params.candidateId,
      candidateName: cand?.full_name,
      registrationNumber: cand?.registration_number,
      scheduleId: params.scheduleId,
      scheduleTitle: sch?.title,
      scannedBy: params.user.id,
      scannedByName: params.user.name,
      scanMethod: params.scanMethod || 'MANUAL',
      scanResult: 'SUCCESS',
      metadata: {
        status: params.status,
        note: params.note,
        deviceInfo: params.deviceInfo,
      },
    });

    await auditService.logAction({
      userId: params.user.id,
      userEmail: params.user.email,
      action: 'ATTENDANCE_UPDATED',
      entityType: 'TEST_SCHEDULE_PARTICIPANT',
      entityId: `${params.scheduleId}_${params.candidateId}`,
      oldValue: { status: oldStatus },
      newValue: { status: params.status, note: params.note, scanMethod: params.scanMethod },
    });

    return { success: true };
  },

  // 11. Get Candidate's Assigned Schedules
  async getCandidateSchedules(candidateId: string): Promise<
    Array<{
      participantId: string;
      scheduleId: string;
      testTypeName: string;
      testTypeCode: string;
      title: string;
      test_date: string;
      start_time: string;
      end_time: string;
      location: string;
      room: string;
      online_url?: string;
      seat_number: string;
      attendance_status: AttendanceStatus;
      attendance_note?: string;
      scanned_at?: string;
      scanned_by_name?: string;
      notes?: string;
    }>
  > {
    const data = getStorageData();
    const assigned = data.testScheduleParticipants.filter((p) => p.candidate_id === candidateId);

    const result = assigned.map((p) => {
      const sch = data.testSchedules.find((s) => s.id === p.schedule_id);
      const type = sch ? data.testTypes.find((t) => t.id === sch.test_type_id) : undefined;
      return {
        participantId: p.id,
        scheduleId: p.schedule_id,
        testTypeName: type?.name || 'Tes Seleksi',
        testTypeCode: type?.code || 'SELEKSI',
        title: sch?.title || 'Sesi Seleksi',
        test_date: sch?.test_date || '-',
        start_time: sch?.start_time || '-',
        end_time: sch?.end_time || '-',
        location: sch?.location || 'PPTQM Darul Hikmah',
        room: sch?.room || '-',
        online_url: sch?.online_url,
        seat_number: p.seat_number,
        attendance_status: p.attendance_status,
        attendance_note: p.attendance_note,
        scanned_at: p.scanned_at,
        scanned_by_name: p.scanned_by_name,
        notes: sch?.notes,
      };
    });

    // Sort by test date and start time
    return result.sort((a, b) => {
      if (a.test_date !== b.test_date) return a.test_date.localeCompare(b.test_date);
      return a.start_time.localeCompare(b.start_time);
    });
  },

  // 12. Get or Generate Verification Token for Candidate
  async getVerificationToken(candidateId: string): Promise<string> {
    const data = getStorageData();
    let token = data.verificationTokens.find((t) => t.candidate_id === candidateId && t.is_active);

    if (!token) {
      const cand = data.candidates.find((c) => c.id === candidateId);
      const reg = cand ? cand.registration_number.replace(/\D/g, '') : '0000';
      const randomHex = Math.random().toString(36).substring(2, 10);
      const tokenHash = `DH27_${reg}_${randomHex}`;

      token = {
        id: `tok-${Date.now()}-${randomHex}`,
        candidate_id: candidateId,
        token_hash: tokenHash,
        is_active: true,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 86400000 * 180).toISOString(),
      };
      data.verificationTokens.push(token);
      saveStorageData(data);
    }

    return token.token_hash;
  },

  // 13. Candidate Photo Helper for Exam Card (PAS_FOTO via signed URL)
  async getCandidatePassportPhoto(candidateId: string): Promise<string | null> {
    const docs = await documentService.getCandidateDocuments(candidateId);
    // Find PAS_FOTO document
    const photoDoc = docs.find((d) => d.document_type?.code === 'PAS_FOTO');
    if (!photoDoc) return null;

    if (photoDoc.signed_url) {
      return photoDoc.signed_url;
    }

    // Try generating signed URL
    const signed = await documentService.getSignedDocumentUrl(photoDoc.file_path);
    return signed || null;
  },

  // 14. Record QR / Manual Scan Log
  async recordScanLog(params: {
    candidateId?: string;
    candidateName?: string;
    registrationNumber?: string;
    tokenId?: string;
    scheduleId?: string;
    scheduleTitle?: string;
    scannedBy?: string;
    scannedByName?: string;
    scanMethod: QrScanMethod;
    scanResult: QrScanResult;
    metadata?: Record<string, any>;
  }): Promise<CandidateQrScanLog> {
    const data = getStorageData();
    const logItem: CandidateQrScanLog = {
      id: `scan-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      candidate_id: params.candidateId,
      candidate_name: params.candidateName,
      registration_number: params.registrationNumber,
      token_id: params.tokenId,
      schedule_id: params.scheduleId,
      schedule_title: params.scheduleTitle,
      scanned_by: params.scannedBy,
      scanned_by_name: params.scannedByName,
      scan_method: params.scanMethod,
      scan_result: params.scanResult,
      scanned_at: new Date().toISOString(),
      metadata: params.metadata || {},
    };

    data.qrScanLogs.unshift(logItem);
    if (data.qrScanLogs.length > 200) {
      data.qrScanLogs = data.qrScanLogs.slice(0, 200);
    }
    saveStorageData(data);

    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase.from('candidate_qr_scan_logs').insert({
          candidate_id: params.candidateId,
          candidate_name: params.candidateName,
          registration_number: params.registrationNumber,
          token_id: params.tokenId,
          schedule_id: params.scheduleId,
          schedule_title: params.scheduleTitle,
          scanned_by: params.scannedBy,
          scanned_by_name: params.scannedByName,
          scan_method: params.scanMethod,
          scan_result: params.scanResult,
          scanned_at: logItem.scanned_at,
          metadata: logItem.metadata,
        });
      } catch (err) {
        console.error('Supabase recordScanLog error', err);
      }
    }

    return logItem;
  },

  // 15. Get Recent Scan Logs
  async getScanLogs(limit: number = 50): Promise<CandidateQrScanLog[]> {
    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase
          .from('candidate_qr_scan_logs')
          .select('*')
          .order('scanned_at', { ascending: false })
          .limit(limit);
        if (!error && data && data.length > 0) {
          return data as CandidateQrScanLog[];
        }
      } catch (err) {
        console.error('Supabase getScanLogs error', err);
      }
    }

    const data = getStorageData();
    return (data.qrScanLogs || []).slice(0, limit);
  },

  // 16. Verify Candidate by QR Code / Token / Registration Number
  async verifyCandidateByQr(
    queryInput: string,
    panitiaUser?: { id: string; email: string; name?: string },
    scanMethod: QrScanMethod = 'MANUAL',
    deviceInfo?: Record<string, any>
  ): Promise<{ success: boolean; result?: CandidateVerifiedQrResult; error?: string; code?: QrScanResult }> {
    if (!queryInput?.trim()) {
      return { success: false, error: 'Silakan masukkan nomor pendaftaran atau pindai QR code peserta.' };
    }

    const trimmed = queryInput.trim();
    const data = getStorageData();

    let candidate: Candidate | undefined;
    let tokenStr: string | undefined;
    let foundTokenObj: CandidateVerificationToken | undefined;
    let isTokenSupplied = false;

    // 1. Try parsing JSON payload
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const json = JSON.parse(trimmed);
        if (json.token) {
          tokenStr = json.token;
          isTokenSupplied = true;
        }
        if (json.reg) {
          candidate = data.candidates.find(
            (c) => c.registration_number.toLowerCase() === String(json.reg).toLowerCase()
          );
        }
      } catch {
        // Not JSON
      }
    }

    // 2. Check if query is standard encoded payload: DH-VERIFY:<REG>:<TOKEN> or DH-CARD:<REG>:<TOKEN>
    if (!candidate && trimmed.includes(':')) {
      const parts = trimmed.split(':');
      const possibleReg = parts.find((p) => p.startsWith('DH-'));
      if (possibleReg) {
        candidate = data.candidates.find(
          (c) => c.registration_number.toLowerCase() === possibleReg.toLowerCase()
        );
      }
      const possibleToken = parts.find((p) => p.startsWith('DH27_') || p.startsWith('tok-'));
      if (possibleToken) {
        tokenStr = possibleToken;
        isTokenSupplied = true;
      } else if (parts.length >= 3 && parts[2]) {
        tokenStr = parts[2];
        isTokenSupplied = true;
      }
    }

    // 3. Check if input directly matches token hash
    if (!candidate) {
      foundTokenObj = data.verificationTokens.find(
        (t) => t.token_hash.toLowerCase() === trimmed.toLowerCase()
      );
      if (foundTokenObj) {
        tokenStr = foundTokenObj.token_hash;
        isTokenSupplied = true;
        candidate = data.candidates.find((c) => c.id === foundTokenObj?.candidate_id);
      }
    }

    // 4. Check if token was parsed, lookup by token
    if (!candidate && tokenStr) {
      foundTokenObj = data.verificationTokens.find(
        (t) => t.token_hash.toLowerCase() === tokenStr?.toLowerCase()
      );
      if (foundTokenObj) {
        candidate = data.candidates.find((c) => c.id === foundTokenObj?.candidate_id);
      }
    }

    // 5. Fallback: Search candidate by registration number (case-insensitive)
    if (!candidate) {
      candidate = data.candidates.find(
        (c) => c.registration_number.toLowerCase() === trimmed.toLowerCase()
      );
    }

    // 6. Fallback: Numeric suffix search if 4 digits e.g. "0001"
    if (!candidate && /^\d{1,4}$/.test(trimmed)) {
      const padded = trimmed.padStart(4, '0');
      candidate = data.candidates.find(
        (c) => c.registration_number.endsWith(padded)
      );
    }

    // A. VALIDATION 1: Candidate not found
    if (!candidate) {
      await this.recordScanLog({
        scannedBy: panitiaUser?.id,
        scannedByName: panitiaUser?.name,
        scanMethod,
        scanResult: 'NOT_FOUND',
        metadata: { query: trimmed, deviceInfo },
      });

      return {
        success: false,
        code: 'NOT_FOUND',
        error: `Data calon santri dengan identifier "${trimmed}" tidak ditemukan dalam sistem PSB PPTQM Darul Hikmah.`,
      };
    }

    // B. VALIDATION 2: Token verification if supplied
    if (isTokenSupplied && tokenStr && tokenStr !== 'VALID') {
      const tokenObj = data.verificationTokens.find(
        (t) => t.token_hash.toLowerCase() === tokenStr?.toLowerCase() && t.candidate_id === candidate?.id
      );

      if (!tokenObj) {
        await this.recordScanLog({
          candidateId: candidate.id,
          candidateName: candidate.full_name,
          registrationNumber: candidate.registration_number,
          scannedBy: panitiaUser?.id,
          scannedByName: panitiaUser?.name,
          scanMethod,
          scanResult: 'INVALID_TOKEN',
          metadata: { query: trimmed, token: tokenStr, deviceInfo },
        });

        return {
          success: false,
          code: 'INVALID_TOKEN',
          error: `Token QR Code (${tokenStr}) tidak valid atau tidak cocok dengan data calon santri ${candidate.full_name}.`,
        };
      }

      if (!tokenObj.is_active) {
        await this.recordScanLog({
          candidateId: candidate.id,
          candidateName: candidate.full_name,
          registrationNumber: candidate.registration_number,
          tokenId: tokenObj.id,
          scannedBy: panitiaUser?.id,
          scannedByName: panitiaUser?.name,
          scanMethod,
          scanResult: 'INVALID_TOKEN',
          metadata: { reason: 'TOKEN_REVOKED', query: trimmed, deviceInfo },
        });

        return {
          success: false,
          code: 'INVALID_TOKEN',
          error: `Token QR Code untuk ${candidate.full_name} telah dinonaktifkan atau dicabut oleh panitia.`,
        };
      }

      if (tokenObj.expires_at && new Date(tokenObj.expires_at).getTime() < Date.now()) {
        await this.recordScanLog({
          candidateId: candidate.id,
          candidateName: candidate.full_name,
          registrationNumber: candidate.registration_number,
          tokenId: tokenObj.id,
          scannedBy: panitiaUser?.id,
          scannedByName: panitiaUser?.name,
          scanMethod,
          scanResult: 'EXPIRED',
          metadata: { expiresAt: tokenObj.expires_at, query: trimmed, deviceInfo },
        });

        return {
          success: false,
          code: 'EXPIRED',
          error: `Masa berlaku kartu/token QR Code untuk ${candidate.full_name} telah berakhir.`,
        };
      }
    }

    // C. VALIDATION 3: Candidate Status Eligibility
    const allowedStatuses = [
      'TERVERIFIKASI',
      'DIIZINKAN_MENGIKUTI_SELEKSI',
      'MENGIKUTI_SELEKSI',
      'SELESAI_SELEKSI',
      'LULUS',
      'CADANGAN',
      'DAFTAR_ULANG',
      'DITERIMA_FINAL',
    ];

    if (!allowedStatuses.includes(candidate.status)) {
      await this.recordScanLog({
        candidateId: candidate.id,
        candidateName: candidate.full_name,
        registrationNumber: candidate.registration_number,
        scannedBy: panitiaUser?.id,
        scannedByName: panitiaUser?.name,
        scanMethod,
        scanResult: 'NOT_ELIGIBLE',
        metadata: { status: candidate.status, query: trimmed, deviceInfo },
      });

      return {
        success: false,
        code: 'NOT_ELIGIBLE',
        error: `Calon santri ${candidate.full_name} (${candidate.registration_number}) belum memenuhi syarat verifikasi seleksi. Status saat ini: "${candidate.status}".`,
      };
    }

    // D. Fetch Photo, Schedules & Active Token
    const [photoUrl, schedules, activeTokenStr] = await Promise.all([
      this.getCandidatePassportPhoto(candidate.id),
      this.getCandidateSchedules(candidate.id),
      this.getVerificationToken(candidate.id),
    ]);

    // E. VALIDATION 4: Double Scan Check (Already Marked HADIR)
    const presentSession = schedules.find((s) => s.attendance_status === 'HADIR');
    const isAlreadyPresent = !!presentSession;

    const alreadyPresentDetails = presentSession
      ? {
          sessionTitle: presentSession.title,
          scannedAt: presentSession.scanned_at,
          scannedByName: presentSession.scanned_by_name || 'Panitia Seleksi',
          status: presentSession.attendance_status,
        }
      : undefined;

    // F. Record Scan Log (SUCCESS or SUCCESS_ALREADY_PRESENT)
    const scanResult: QrScanResult = isAlreadyPresent ? 'SUCCESS_ALREADY_PRESENT' : 'SUCCESS';

    await this.recordScanLog({
      candidateId: candidate.id,
      candidateName: candidate.full_name,
      registrationNumber: candidate.registration_number,
      scheduleId: schedules[0]?.scheduleId,
      scheduleTitle: schedules[0]?.title,
      scannedBy: panitiaUser?.id,
      scannedByName: panitiaUser?.name,
      scanMethod,
      scanResult,
      metadata: {
        isAlreadyPresent,
        sessionCount: schedules.length,
        deviceInfo,
      },
    });

    if (panitiaUser) {
      await auditService.logAction({
        userId: panitiaUser.id,
        userEmail: panitiaUser.email,
        action: 'QR_VERIFICATION',
        entityType: 'CANDIDATE',
        entityId: candidate.id,
        newValue: {
          registration_number: candidate.registration_number,
          scanMethod,
          scanResult,
        },
      });
    }

    // Return sanitized summary - NO NIK, NO PARENT DATA, NO ADDRESS
    const result: CandidateVerifiedQrResult = {
      candidate: {
        id: candidate.id,
        registration_number: candidate.registration_number,
        full_name: candidate.full_name,
        nisn: candidate.nisn,
        school_name: candidate.school_name,
        status: candidate.status,
        gender: candidate.gender,
      },
      photoUrl,
      verificationToken: activeTokenStr,
      isTokenValid: true,
      isVerifiedEligible: true,
      alreadyPresent: isAlreadyPresent,
      alreadyPresentDetails,
      schedules,
    };

    return { success: true, result };
  },

  // 15. Candidate Notifications
  async getCandidateNotifications(candidateId: string): Promise<CandidateNotification[]> {
    const data = getStorageData();
    return data.notifications
      .filter((n) => n.candidate_id === candidateId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  },

  async markNotificationAsRead(id: string): Promise<void> {
    const data = getStorageData();
    const item = data.notifications.find((n) => n.id === id);
    if (item) {
      item.is_read = true;
      saveStorageData(data);
    }
  }
};

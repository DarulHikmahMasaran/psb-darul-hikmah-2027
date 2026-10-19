import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { getStorageData, saveStorageData, generateNextRegistrationNumber } from '../lib/storage';
import { AuthUser, SignInPayload, SignUpPayload } from '../types/auth';
import { Candidate, Profile } from '../types/database';
import { auditService } from './auditService';
import { validateRegistrationForm } from '../utils/validation';

const CURRENT_USER_KEY = 'psb_active_session_user';

export const authService = {
  async register(payload: SignUpPayload): Promise<{ success: boolean; user?: AuthUser; error?: string }> {
    const validation = validateRegistrationForm(payload);
    if (!validation.isValid) {
      const firstError = Object.values(validation.errors)[0];
      return { success: false, error: firstError };
    }

    const email = payload.email.trim().toLowerCase();
    const storageData = getStorageData();

    // Check duplicate email
    const duplicateProfile = storageData.profiles.find(
      (p) => p.email.toLowerCase() === email
    );
    if (duplicateProfile) {
      return { success: false, error: 'Email sudah terdaftar. Silakan masuk menggunakan akun Anda.' };
    }

    let authUserId = `usr-${Date.now()}`;
    let profileId = `prof-${Date.now()}`;
    let candidateId = `cand-${Date.now()}`;
    let regNumber = generateNextRegistrationNumber();

    // If Supabase is configured, use Supabase Auth
    if (isSupabaseConfigured() && supabase) {
      try {
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: payload.email,
          password: payload.password,
          options: {
            data: {
              full_name: payload.fullName.trim(),
              phone: payload.phone.trim(),
            },
          },
        });

        if (authError) {
          return { success: false, error: authError.message };
        }

        if (authData.user) {
          authUserId = authData.user.id;

          // Check if PostgreSQL trigger on_auth_user_created automatically provisioned the profile
          const { data: triggerProfile } = await supabase
            .from('profiles')
            .select('*')
            .eq('user_id', authUserId)
            .maybeSingle();

          const { data: triggerCandidate } = await supabase
            .from('candidates')
            .select('*')
            .eq('user_id', authUserId)
            .maybeSingle();

          if (triggerProfile) {
            // Profile was safely provisioned by server-side database trigger
            const authUser: AuthUser = {
              id: authUserId,
              email,
              phone: payload.phone.trim(),
              role: 'PESERTA',
              profile: triggerProfile as Profile,
            };

            if (typeof window !== 'undefined') {
              try { localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(authUser)); } catch {}
            }

            if (triggerCandidate) {
              storageData.candidates.push(triggerCandidate as Candidate);
            }
            storageData.profiles.push(triggerProfile as Profile);
            saveStorageData(storageData);

            await auditService.logAction({
              userId: authUserId,
              userEmail: email,
              action: 'USER_REGISTER',
              entityType: 'AUTH',
              entityId: authUserId,
              newValue: {
                registration_number: triggerCandidate?.registration_number || regNumber,
                full_name: payload.fullName,
              },
            });

            return { success: true, user: authUser };
          }
        }
      } catch (err: any) {
        console.error('Supabase auth error during sign up', err);
        return { success: false, error: err.message || 'Terjadi kesalahan saat mendaftar ke server.' };
      }
    }

    // 2. Buat Profile - Role strictly forced to 'PESERTA' (No client role override possible)
    const newProfile: Profile = {
      id: profileId,
      user_id: authUserId,
      full_name: payload.fullName.trim(),
      email,
      phone: payload.phone.trim(),
      role: 'PESERTA',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // 3. Buat Candidate - Status starts at 'DRAFT'
    const newCandidate: Candidate = {
      id: candidateId,
      user_id: authUserId,
      registration_number: regNumber,
      full_name: payload.fullName.trim(),
      religion: 'Islam',
      guardian_phone: payload.phone.trim(),
      status: 'DRAFT',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Sync to Supabase DB tables if connected (enforced by RLS)
    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase.from('profiles').insert(newProfile);
        await supabase.from('candidates').insert(newCandidate);
      } catch (err) {
        console.error('Failed to sync profile/candidate to Supabase', err);
      }
    }

    // Save to storage
    storageData.profiles.push(newProfile);
    storageData.candidates.push(newCandidate);
    if (!isSupabaseConfigured()) {
      storageData.credentials[email] = payload.password;
    }
    saveStorageData(storageData);

    const authUser: AuthUser = {
      id: authUserId,
      email,
      phone: payload.phone,
      role: 'PESERTA',
      profile: newProfile,
    };

    if (typeof window !== 'undefined') {
      try { localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(authUser)); } catch {}
    }

    // Log audit
    await auditService.logAction({
      userId: authUserId,
      userEmail: email,
      action: 'USER_REGISTER',
      entityType: 'AUTH',
      entityId: authUserId,
      newValue: {
        registration_number: regNumber,
        full_name: payload.fullName,
      },
    });

    return { success: true, user: authUser };
  },

  async login(payload: SignInPayload): Promise<{ success: boolean; user?: AuthUser; error?: string }> {
    const email = payload.email.trim().toLowerCase();
    const password = payload.password;

    if (!email || !password) {
      return { success: false, error: 'Silakan isi email dan kata sandi.' };
    }

    // Try Supabase Auth first if configured
    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          return { success: false, error: 'Email atau kata sandi tidak cocok. Silakan periksa kembali.' };
        }

        if (data.user) {
          // Fetch profile from supabase
          const { data: profileData } = await supabase
            .from('profiles')
            .select('*')
            .eq('user_id', data.user.id)
            .maybeSingle();

          const role = profileData?.role || 'PESERTA';
          const authUser: AuthUser = {
            id: data.user.id,
            email: data.user.email || email,
            role,
            profile: profileData || {
              id: data.user.id,
              user_id: data.user.id,
              full_name: profileData?.full_name || email.split('@')[0],
              email,
              role,
              is_active: true,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          };

          if (typeof window !== 'undefined') {
            try { localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(authUser)); } catch {}
          }

          await auditService.logAction({
            userId: authUser.id,
            userEmail: email,
            action: 'USER_LOGIN',
            entityType: 'AUTH',
            entityId: authUser.id,
          });

          return { success: true, user: authUser };
        }
      } catch (err: any) {
        console.error('Supabase login error', err);
      }
    }

    // Check storage
    const storageData = getStorageData();
    const registeredPass = storageData.credentials[email];
    const profile = storageData.profiles.find((p) => p.email.toLowerCase() === email);

    if (!profile || registeredPass !== password) {
      return { success: false, error: 'Email atau kata sandi yang Anda masukkan salah.' };
    }

    if (!profile.is_active) {
      return { success: false, error: 'Akun Anda sedang dinonaktifkan oleh administrator.' };
    }

    const authUser: AuthUser = {
      id: profile.user_id,
      email: profile.email,
      phone: profile.phone,
      role: profile.role,
      profile,
    };

    if (typeof window !== 'undefined') {
      try { localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(authUser)); } catch {}
    }

    await auditService.logAction({
      userId: authUser.id,
      userEmail: email,
      action: 'USER_LOGIN',
      entityType: 'AUTH',
      entityId: authUser.id,
    });

    return { success: true, user: authUser };
  },

  loginAsDemoSuperAdmin(): { success: boolean; user?: AuthUser; error?: string } {
    // Mode demo diizinkan secara default pada edisi gratis tanpa billing

    const storageData = getStorageData();
    const existingAdminProfile = storageData.profiles.find(
      (p) => p.email.toLowerCase() === 'admin@darulhikmah.sch.id' && p.role === 'SUPER_ADMIN'
    );

    const demoUser: AuthUser = {
      id: existingAdminProfile ? existingAdminProfile.user_id : 'usr-super-admin-demo',
      email: existingAdminProfile ? existingAdminProfile.email : 'admin@darulhikmah.sch.id',
      phone: existingAdminProfile?.phone || '081234567890',
      role: 'SUPER_ADMIN',
      isDemoMode: true,
      profile: existingAdminProfile || {
        id: 'prof-super-admin-demo',
        user_id: 'usr-super-admin-demo',
        full_name: 'Ustadz H. Ahmad Fauzan (Super Admin Demo)',
        email: 'admin@darulhikmah.sch.id',
        phone: '081234567890',
        role: 'SUPER_ADMIN',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    };

    if (typeof window !== 'undefined') {
      try { localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(demoUser)); } catch {}
    }

    return { success: true, user: demoUser };
  },

  isDemoSession(): boolean {
    const current = this.getCurrentUser();
    return Boolean(current?.isDemoMode);
  },

  async logout(): Promise<void> {
    const current = this.getCurrentUser();
    if (current) {
      await auditService.logAction({
        userId: current.id,
        userEmail: current.email,
        action: 'USER_LOGOUT',
        entityType: 'AUTH',
        entityId: current.id,
      });
    }

    if (typeof window !== 'undefined') {
      try { localStorage.removeItem(CURRENT_USER_KEY); } catch {}
    }

    if (!current?.isDemoMode && isSupabaseConfigured() && supabase) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.error('Supabase signOut error', err);
      }
    }
  },

  getCurrentUser(): AuthUser | null {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem(CURRENT_USER_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },

  async resetPassword(email: string): Promise<{ success: boolean; message: string }> {
    if (!email.trim()) {
      return { success: false, message: 'Silakan masukkan alamat email yang terdaftar.' };
    }

    if (isSupabaseConfigured() && supabase) {
      try {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
        if (error) {
          return { success: false, message: error.message };
        }
      } catch (err) {
        console.error('Supabase reset password error', err);
      }
    }

    await auditService.logAction({
      userEmail: email,
      action: 'PASSWORD_RESET_REQUESTED',
      entityType: 'AUTH',
    });

    return {
      success: true,
      message: 'Instruksi reset kata sandi telah dikirim ke email Anda. Silakan periksa kotak masuk atau spam.',
    };
  },
};

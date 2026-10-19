import { Profile, UserRole } from './database';

export interface AuthUser {
  id: string;
  email: string;
  phone?: string;
  role: UserRole;
  profile: Profile;
  isDemoMode?: boolean;
}

export interface SignUpPayload {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
}

export interface SignInPayload {
  email: string;
  password: string;
}

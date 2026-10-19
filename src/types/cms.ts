export type VersionStatus = 'DRAFT' | 'REVIEW' | 'PUBLISHED' | 'ARCHIVED';

export type ContactType = 
  | 'WHATSAPP' 
  | 'INSTAGRAM' 
  | 'EMAIL' 
  | 'WEBSITE' 
  | 'ALAMAT' 
  | 'FACEBOOK' 
  | 'YOUTUBE' 
  | 'TIKTOK' 
  | 'OTHER';

export type RequirementCategory = 'UMUM' | 'BERKAS';

export interface LandingPageSettings {
  id: string;
  site_name: string;
  site_short_name: string;
  academic_year: string;
  program_label: string;
  logo_path?: string;
  logo_url?: string;
  favicon_path?: string;
  hero_badge: string;
  hero_title: string;
  hero_highlight: string;
  hero_subtitle?: string;
  hero_description: string;
  hero_primary_button_text: string;
  hero_primary_button_link: string;
  hero_secondary_button_text: string;
  hero_secondary_button_link: string;
  meta_title?: string;
  meta_description?: string;
  og_title?: string;
  og_description?: string;
  og_image?: string;
  // Bottom Call-To-Action (CTA) Settings
  cta_title?: string;
  cta_description?: string;
  cta_primary_button_text?: string;
  cta_primary_button_link?: string;
  cta_primary_button_active?: boolean;
  cta_secondary_button_text?: string;
  cta_secondary_button_link?: string;
  cta_secondary_button_active?: boolean;
  updated_by?: string;
  updated_at: string;
}

export interface LandingPageStat {
  id: string;
  label: string;
  value: string;
  description?: string;
  icon_key?: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LandingPageRequirement {
  id: string;
  category: RequirementCategory;
  title: string;
  description: string;
  icon_key?: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LandingPageStep {
  id: string;
  step_number: string;
  title: string;
  description: string;
  icon_key?: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LandingPageSchedule {
  id: string;
  title: string;
  description: string;
  event_date_text: string;
  badge_color?: 'emerald' | 'amber' | 'blue' | 'teal' | 'purple';
  test_schedule_id?: string;
  is_public: boolean;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LandingPageFaq {
  id: string;
  question: string;
  answer: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LandingPageContact {
  id: string;
  contact_type: ContactType;
  label: string;
  value: string;
  link?: string;
  icon_key?: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LandingPageAnnouncement {
  id: string;
  title: string;
  content: string;
  button_text?: string;
  button_link?: string;
  start_at?: string;
  end_at?: string;
  is_active: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface LandingPageSnapshot {
  settings: LandingPageSettings;
  stats: LandingPageStat[];
  requirements: LandingPageRequirement[];
  steps: LandingPageStep[];
  schedules: LandingPageSchedule[];
  faqs: LandingPageFaq[];
  contacts: LandingPageContact[];
  announcements: LandingPageAnnouncement[];
}

export interface LandingPageVersion {
  id: string;
  version_number: number;
  content_snapshot: LandingPageSnapshot;
  status: VersionStatus;
  created_by?: string;
  created_by_name?: string;
  created_at: string;
  published_by?: string;
  published_by_name?: string;
  published_at?: string;
  notes?: string;
}

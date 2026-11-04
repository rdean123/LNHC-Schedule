/**
 * Database types for the Supabase schema in supabase/migrations.
 *
 * Hand-written to match the migrations because the hosted project was not reachable when this
 * was written. Once the migrations are applied, regenerate and replace this file:
 *   npx supabase gen types typescript --project-id <ref> > src/types/database.ts
 * Keep the exported helper types at the bottom.
 */

type Table<Row, Required extends keyof Row, Rel extends readonly unknown[] = []> = {
  Row: Row;
  Insert: Pick<Row, Required> & Partial<Row>;
  Update: Partial<Row>;
  Relationships: Rel;
};

type Fk<Column extends string, Table extends string, OneToOne extends boolean = false> = {
  foreignKeyName: string;
  columns: [Column];
  isOneToOne: OneToOne;
  referencedRelation: Table;
  referencedColumns: ['id'];
};

export type AppRole = 'admin' | 'scheduler' | 'volunteer';
export type PublishStatus = 'draft' | 'published';

export type UserRoleRow = {
  user_id: string;
  role: AppRole;
  created_at: string;
  updated_at: string;
};
export type VolunteerRow = {
  id: string;
  display_name: string;
  user_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};
export type VolunteerContactRow = {
  volunteer_id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  updated_at: string;
};
export type MinistryRow = { id: string; name: string; created_at: string };
export type VenueRow = {
  id: string;
  name: string;
  address: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};
export type PositionRow = {
  id: string;
  ministry_id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};
export type VenuePositionRow = {
  venue_id: string;
  position_id: string;
  label: string | null;
  sort_order: number;
};
export type QualificationRow = {
  volunteer_id: string;
  position_id: string;
  created_at: string;
  created_by: string | null;
};
export type AvailabilityRow = {
  volunteer_id: string;
  service_date: string;
  is_available: boolean;
  note: string | null;
  updated_at: string;
};
export type ServiceRow = {
  id: string;
  venue_id: string;
  service_date: string;
  status: PublishStatus;
  published_at: string | null;
  published_by: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
};
export type AssignmentRow = {
  id: string;
  service_id: string;
  service_date: string;
  position_id: string;
  volunteer_id: string;
  created_at: string;
  created_by: string | null;
};
export type AnnouncementRow = {
  id: string;
  title: string;
  body: string;
  venue_id: string | null;
  is_pinned: boolean;
  published_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};
export type AuditLogRow = {
  id: number;
  actor_id: string | null;
  action: string;
  table_name: string;
  record_id: string | null;
  old_data: unknown;
  new_data: unknown;
  created_at: string;
};

export type ScheduleProblemKind = 'inactive' | 'not_qualified' | 'away' | 'position_not_at_venue';

/** A problem with an existing assignment. `message` is written for people. */
export type ScheduleProblem = {
  service_id: string;
  assignment_id: string;
  venue_id: string;
  service_date: string;
  volunteer_id: string;
  position_id: string;
  problem: ScheduleProblemKind;
  message: string;
};

export type SuggestionStatus = 'available' | 'no_answer' | 'away' | 'already_assigned';

/** A qualified volunteer for a position on a service, and whether they can be assigned. */
export type VolunteerSuggestion = {
  volunteer_id: string;
  display_name: string;
  can_assign: boolean;
  status: SuggestionStatus;
  reason: string;
  last_served: string | null;
  times_served_8_weeks: number;
};

export type AssignmentHistoryEntry = {
  changed_at: string;
  action: 'added' | 'removed' | 'changed';
  actor_name: string;
  volunteer_name: string;
  position_name: string;
};

export type CopyScheduleResult = {
  services_created: number;
  assignments_created: number;
  skipped: { service_date: string; volunteer: string; position: string; reason: string }[];
  days_skipped: { service_date: string; reason: string }[];
};

export type Database = {
  public: {
    Tables: {
      user_roles: Table<UserRoleRow, 'user_id'>;
      volunteers: Table<
        VolunteerRow,
        'display_name',
        [Fk<'volunteer_id', 'volunteer_contacts', true>]
      >;
      volunteer_contacts: Table<
        VolunteerContactRow,
        'volunteer_id',
        [Fk<'volunteer_id', 'volunteers', true>]
      >;
      ministries: Table<MinistryRow, 'name'>;
      venues: Table<VenueRow, 'name'>;
      positions: Table<PositionRow, 'ministry_id' | 'name', [Fk<'ministry_id', 'ministries'>]>;
      venue_positions: Table<
        VenuePositionRow,
        'venue_id' | 'position_id',
        [Fk<'venue_id', 'venues'>, Fk<'position_id', 'positions'>]
      >;
      volunteer_qualifications: Table<
        QualificationRow,
        'volunteer_id' | 'position_id',
        [Fk<'volunteer_id', 'volunteers'>, Fk<'position_id', 'positions'>]
      >;
      volunteer_availability: Table<
        AvailabilityRow,
        'volunteer_id' | 'service_date' | 'is_available',
        [Fk<'volunteer_id', 'volunteers'>]
      >;
      services: Table<ServiceRow, 'venue_id' | 'service_date', [Fk<'venue_id', 'venues'>]>;
      assignments: Table<
        AssignmentRow,
        'service_id' | 'service_date' | 'position_id' | 'volunteer_id',
        [
          Fk<'service_id', 'services'>,
          Fk<'position_id', 'positions'>,
          Fk<'volunteer_id', 'volunteers'>,
        ]
      >;
      announcements: Table<AnnouncementRow, 'title' | 'body', [Fk<'venue_id', 'venues'>]>;
      audit_logs: Table<AuditLogRow, 'action' | 'table_name'>;
    };
    Views: Record<string, never>;
    Functions: {
      is_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      is_staff: { Args: Record<PropertyKey, never>; Returns: boolean };
      current_volunteer_id: { Args: Record<PropertyKey, never>; Returns: string | null };
      schedule_problems: {
        Args: { p_from: string; p_to: string; p_venue_id?: string };
        Returns: ScheduleProblem[];
      };
      suggest_volunteers: {
        Args: { p_service_id: string; p_position_id: string };
        Returns: VolunteerSuggestion[];
      };
      assignment_history: { Args: { p_service_id: string }; Returns: AssignmentHistoryEntry[] };
      copy_schedule: {
        Args: {
          p_venue_id: string;
          p_source_start: string;
          p_source_end: string;
          p_target_start: string;
        };
        Returns: CopyScheduleResult;
      };
    };
    Enums: { app_role: AppRole; publish_status: PublishStatus };
    CompositeTypes: Record<string, never>;
  };
};

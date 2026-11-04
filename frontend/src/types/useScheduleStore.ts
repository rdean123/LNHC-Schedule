import { create } from 'zustand';
import type { Member, LocationId, ScheduleRow } from '../types/types';
import { getMembers, getSchedules, deleteSchedule } from '../services/client';

interface ScheduleState {
  members: Member[];
  schedules: Record<LocationId, ScheduleRow[]>;
  fetchMembers: () => Promise<void>;
  fetchSchedules: (locationId?: LocationId) => Promise<void>;
  setMembers: (members: Member[]) => void;

  addMember: (name: string) => void;
  deleteMember: (id: string) => void;

  addScheduleRow: (locationId: LocationId, date: string) => void;
  updateAssignment: (
    locationId: LocationId,
    rowId: string,
    roleKey: string,
    memberId: string
  ) => void;

  updateRowDate: (locationId: LocationId, rowId: string, date: string) => void;

  deleteScheduleRowFromDB: (locationId: LocationId, rowId: string) => Promise<void>;

  isMemberAssignedElsewhere: (
    memberId: string,
    date: string,
    currentLocationId: LocationId,
    currentRowId: string,
    currentRoleKey: string
  ) => boolean;
}

export const useScheduleStore = create<ScheduleState>((set, get) => ({
  // ======================
  // STATE
  // ======================
  members: [],

  schedules: {
    LNHC: [],
    Tangway: [],
    GarciaRosario: [],
  },

  // ======================
  // FETCH MEMBERS
  // ======================
  fetchMembers: async () => {
    try {
      const data = await getMembers();
      set({ members: data });
    } catch (err) {
      console.error('Failed to fetch members:', err);
    }
  },

  // ======================
  // FETCH SCHEDULES (FROM BACKEND DB)
  // ======================
  fetchSchedules: async (locationId) => {
    try {
      // If a locationId is passed, only update that one. Otherwise, refresh all three.
      const locations: LocationId[] = locationId 
        ? [locationId] 
        : ['LNHC', 'Tangway', 'GarciaRosario'];
        
      const updatedSchedules = { ...get().schedules };

      for (const loc of locations) {
        const dbRows = await getSchedules(loc);

        updatedSchedules[loc] = dbRows.map((dbRow: any) => {
          const assignments: Record<string, string> = {};

          Object.keys(dbRow).forEach((key) => {
            if (key.endsWith('_id') && dbRow[key]) {
              const frontendKey = key.replace('_id', '');
              assignments[frontendKey] = String(dbRow[key]);
            } else if (key !== 'id' && key !== 'date' && dbRow[key]) {
              assignments[key] = String(dbRow[key]);
            }
          });

          return {
            id: dbRow.id || crypto.randomUUID(),
            date: dbRow.date,
            assignments,
          };
        });
      }

      set({ schedules: updatedSchedules });
    } catch (err) {
      console.error('Failed to fetch schedules:', err);
    }
  },

  // ======================
  // MEMBERS HANDLERS
  // ======================
  setMembers: (members) => set(() => ({ members })),

  addMember: (name) =>
    set((state) => ({
      members: [...state.members, { id: crypto.randomUUID(), name }],
    })),

  deleteMember: (id) =>
    set((state) => ({
      members: state.members.filter((m) => m.id !== id),
    })),

    // ======================
    // SCHEDULES WORKING STATE
    // ======================
    addScheduleRow: (locationId, initialDate) => set((state) => {
    const newRow = {
        id: `temp-${crypto.randomUUID()}`, // ✨ Explicitly prefix with 'temp-'
        date: initialDate,
        assignments: {}
    };

      return {
        schedules: {
          ...state.schedules,
          [locationId]: [...state.schedules[locationId], newRow],
        },
      };
    }),

  updateRowDate: (locationId, rowId, date) =>
  set((state) => ({
    schedules: {
      ...state.schedules,
      [locationId]: state.schedules[locationId].map((row) =>
        row.id === rowId 
          ? { ...row, date } 
          : row
      ),
    },
  })),

  updateAssignment: (locationId, rowId, roleKey, memberId) =>
    set((state) => ({
      schedules: {
        ...state.schedules,
        [locationId]: state.schedules[locationId].map((row) =>
          row.id === rowId
            ? {
                ...row,
                assignments: {
                  ...row.assignments,
                  [roleKey]: memberId,
                },
              }
            : row
        ),
      },
    })),

    // ==========================================
  // ✨ NEW: DELETE SCHEDULE FROM DB AND STORE
  // ==========================================
  deleteScheduleRowFromDB: async (locationId: LocationId, rowId: string | number) => {
  // Check if it's an existing database record
  const isExistingRecord = rowId && !String(rowId).startsWith('temp') && !String(rowId).startsWith('row');

  if (isExistingRecord) {
    // 👈 ADD PROMPT HERE
    const confirmed = window.confirm(
      "Are you sure you want to permanently delete this schedule record from the database? This action cannot be undone."
    );
    
    if (!confirmed) {
      return; // Cancel execution if the user clicks 'Cancel'
    }

    try {
      await deleteSchedule(locationId, rowId);
      // Remove from local state after successful backend deletion
      set((state) => ({
        schedules: {
          ...state.schedules,
          [locationId]: state.schedules[locationId].filter((row) => row.id !== rowId),
        },
      }));
    } catch (error: any) {
      console.error("Failed to delete schedule row:", error);
      throw error; 
    }
  } else {
    // If it's just a local UI row that hasn't been saved yet, delete it immediately
    set((state) => ({
      schedules: {
        ...state.schedules,
        [locationId]: state.schedules[locationId].filter((row) => row.id !== rowId),
      },
    }));
  }
},
  
  // ======================
  // CONFLICT CHECK
  // ======================
  isMemberAssignedElsewhere: (
    memberId,
    date,
    currentLocationId,
    currentRowId,
    currentRoleKey
  ) => {
    if (!memberId || !date) return false;

    const { schedules } = get();

    for (const locId of Object.keys(schedules) as LocationId[]) {
      for (const row of schedules[locId]) {
        if (row.date === date) {
          for (const [roleKey, assignedMemberId] of Object.entries(row.assignments)) {
            if (String(assignedMemberId) === String(memberId)) {
              if (
                locId === currentLocationId &&
                row.id === currentRowId &&
                roleKey === currentRoleKey
              ) {
                continue;
              }
              return true;
            }
          }
        }
      }
    }

    return false;
  },
}));
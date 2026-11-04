export interface Member {
  id: string;
  name: string;
}

export type LocationId = 'LNHC' | 'Tangway' | 'GarciaRosario';

export type LNHCId =
  | 'song_leader_id'
  | 'backup_1'
  | 'backup_2'
  | 'leadGuitar'
  | 'acoustic'
  | 'bass'
  | 'keyboard'
  | 'drummer'
  | 'soundTech'
  | 'easyWorship';

export type TangwayId =
  | 'song_leader_id'
  | 'musician'
  | 'multimedia'
  | 'soundTech';

export type GarciaRosarioId =
  | 'singer'
  | 'musicians';

// KEEP THIS (important)
export interface SchedulePayload {
  date: string;
  [key: string]: string;
}

export interface ScheduleRow {
  id: string;
  date: string;
  assignments: Record<string, string>;
}

export interface LocationConfig {
  id: LocationId;
  name: string;
  roles: { key: string; label: string }[];
}

export const LOCATION_CONFIGS: Record<LocationId, LocationConfig> = {
  LNHC: {
    id: 'LNHC',
    name: 'LNHC',
    roles: [
      { key: 'song_leader', label: 'Song Leader' },
      { key: 'backup_1', label: 'Backup 1' },
      { key: 'backup_2', label: 'Backup 2' },
      { key: 'lead_guitar', label: 'Lead Guitar' },
      { key: 'acoustic', label: 'Acoustic' },
      { key: 'bass', label: 'Bass' },
      { key: 'keyboard', label: 'Keyboard' },
      { key: 'drummer', label: 'Drummer' },
      { key: 'sound_tech', label: 'Sound Tech' },
      { key: 'easy_worship', label: 'Easy Worship' },
    ],
  },

  Tangway: {
    id: 'Tangway',
    name: 'Tangway',
    roles: [
      { key: 'song_leader', label: 'Song Leader' },
      { key: 'musician', label: 'Musician' },
      { key: 'multimedia', label: 'Multimedia' },
      { key: 'sound_tech', label: 'Sound Tech' },
    ],
  },

  GarciaRosario: {
    id: 'GarciaRosario',
    name: 'Garcia/Rosario',
    roles: [
      { key: 'singer', label: 'Singer' },
      { key: 'musicians', label: 'Musicians' },
    ],
  },
};
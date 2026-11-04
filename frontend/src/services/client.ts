const BASE_URL = import.meta.env.VITE_API_URL;
import type { LocationId, SchedulePayload } from '../types/types';

// =====================
// ENDPOINT MAP
// =====================

const endpointMap: Record<LocationId, string> = {
  LNHC: '/lnhc',
  Tangway: '/tangway',
  GarciaRosario: '/garcia-rosario',
};

// =====================
// MEMBERS
// =====================

export async function getMembers() {
  const res = await fetch(`${BASE_URL}/members`);

  if (!res.ok) {
    throw new Error('Failed to fetch members');
  }

  return res.json();
}

export async function createMember(name: string) {
  const res = await fetch(`${BASE_URL}/members`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.detail || 'Error creating member');
  }

  return res.json();
}

// ADD THIS (you already have backend endpoint)
export async function deleteMember(memberId: string) {
  const res = await fetch(`${BASE_URL}/members/${memberId}`, {
    method: 'DELETE',
  });

  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.detail || 'Error deleting member');
  }

  return res.json();
}

// =====================
// SCHEDULE API
// =====================

export async function createSchedule(
  location: LocationId,
  payload: SchedulePayload
) {
  const endpoint = endpointMap[location];

  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.detail || 'Error saving schedule');
  }

  return res.json();
}

export const getSchedules = async (locationId: 'LNHC' | 'Tangway' | 'GarciaRosario') => {
  // Convert locationId camelCase or PascalCase to match your backend route names
  const path = locationId === 'GarciaRosario' ? 'garcia-rosario' : locationId.toLowerCase();
  const response = await fetch(`${BASE_URL}/${path}`);
  if (!response.ok) throw new Error(`Failed to fetch schedules for ${locationId}`);
  return await response.json();
};

export const updateSchedule = async (
  location: LocationId,
  id: number | string,
  payload: any
) => {
  // Use your existing mapping to translate 'GarciaRosario' -> '/garcia-rosario'
  const endpoint = endpointMap[location]; 

  const response = await fetch(`${BASE_URL}${endpoint}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.detail || 'Failed to update database schedule record');
  }
  return response.json();
};

export const deleteSchedule = async (location: LocationId, id: number | string) => {
  const endpoint = endpointMap[location]; 
  const response = await fetch(`${BASE_URL}${endpoint}/${id}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.detail || `Failed to delete schedule record ${id} from ${location}`);
  }
  return response.json();
};
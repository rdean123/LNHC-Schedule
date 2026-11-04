import React from 'react';
import { useScheduleStore } from '../types/useScheduleStore';
import type { LocationId, Member } from '../types/types';

interface ConflictDropdownProps {
    locationId: LocationId;
    members: Member[];
    rowId: string;
    date: string;
    roleKey: string;
    value: string;
    onChange: (value: string) => void;
}

export const ConflictDropdown: React.FC<ConflictDropdownProps> = ({
  locationId,
  rowId,
  date,
  roleKey,
  value,
  onChange,
  members,
}) => {
  const { isMemberAssignedElsewhere, schedules } = useScheduleStore();

  // Find if there is an intra-row conflict (same person, different role in the same row)
  const currentRow = schedules[locationId]?.find(r => r.id === rowId);
  
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full p-1.5 rounded text-sm border focus:outline-none focus:ring-2 ${
        value ? 'bg-emerald-50 border-emerald-300 text-emerald-900' : 'bg-white border-gray-300'
      }`}
    >
      <option value="">-- Assign --</option>
      {members.map((member) => {
        // 1. Cross-location & date conflict verification
        const isDoubleBooked = isMemberAssignedElsewhere(member.id, date, locationId, rowId, roleKey);
        
        // 2. Same-row role duplication verification
        const isAssignedInSameRow = Object.entries(currentRow?.assignments || {}).some(
          ([rKey, mId]) => mId === member.id && rKey !== roleKey
        );

        const isDisabled = isDoubleBooked || isAssignedInSameRow;

        return (
          <option 
            key={member.id} 
            value={member.id} 
            disabled={isDisabled}
            className={isDisabled ? 'text-red-400 bg-red-50' : 'text-gray-900'}
          >
            {member.name} {isDoubleBooked ? '⚠️ (Unavailable)' : isAssignedInSameRow ? '⚡ (Multi-role)' : ''}
          </option>
        );
      })}
    </select>
  );
};
import { useEffect, useState } from 'react';
import type { Member } from '../types/types';
import {
  getMembers,
  createMember
//   deleteMember
} from '../services/client';

export const MemberManagement: React.FC = () => {
  const [members, setMembers] = useState<Member[]>([]);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        setIsFetching(true);
        const data = await getMembers();
        setMembers(data);
      } catch (err) {
        console.error("❌ FETCH ERROR:", err);
      } finally {
        setIsFetching(false);
      }
    };

    load();
  }, []);

  // =====================
  // CREATE MEMBER
  // =====================
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) return;

    try {
      setLoading(true);

      const newMember = await createMember(name);

      setMembers(prev => [...prev, newMember]);
      setName('');
    } catch (err) {
      console.error("❌ ERROR:", err);
      alert('Failed to add member');
    } finally {
      setLoading(false);
    }
  };

  // =====================
  // DELETE MEMBER
  // =====================
//   const handleDelete = async (id: string) => {
//     try {
//       await deleteMember(id);
//       setMembers(prev => prev.filter(m => m.id !== id));
//     } catch (err) {
//       console.error(err);
//       alert('Failed to delete member');
//     }
//   };

  return (
    <div className="bg-white p-4 sm:p-6 rounded-xl shadow border border-gray-200 mb-8">
      <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-4">
        Worship Ministry Registry
      </h2>

      {/* 📱 Stacks vertically on mobile, aligns horizontally on small screens and up */}
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2 mb-4">
        <input
          type="text"
          placeholder="Enter volunteer roster name..."
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={isFetching || loading}
          className="w-full sm:flex-1 p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm disabled:bg-gray-50"
        />

        <button
          type="submit"
          disabled={loading || isFetching || !name.trim()}
          className="w-full sm:w-auto justify-center px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-medium rounded-md text-sm transition-colors flex items-center gap-2 whitespace-nowrap"
        >
          {loading && (
            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
          )}
          {loading ? 'Adding...' : '+ Add Member'}
        </button>
      </form>

      {/* Roster Badge Area */}
      <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto p-2 bg-gray-50 rounded-lg border border-dashed border-gray-200">
        {isFetching ? (
          /* SKELETON LOADING UI */
          <div className="w-full flex flex-wrap gap-2 animate-pulse py-1">
            <div className="h-7 w-24 bg-gray-200 rounded-full"></div>
            <div className="h-7 w-32 bg-gray-200 rounded-full"></div>
            <div className="h-7 w-20 bg-gray-200 rounded-full"></div>
            <div className="h-7 w-28 bg-gray-200 rounded-full"></div>
          </div>
        ) : members.length === 0 ? (
          <p className="text-gray-400 text-sm italic w-full text-center py-2">
            No active volunteers listed.
          </p>
        ) : (
          members.map((member) => (
            <div
              key={member.id}
              className="flex items-center gap-2 bg-white px-3 py-1 rounded-full border border-gray-200 shadow-sm text-xs font-medium text-gray-700 max-w-full truncate"
            >
              <span className="truncate">{member.name}</span>

              {/* <button
                onClick={() => handleDelete(member.id)}
                className="text-red-400 hover:text-red-600 font-bold transition-colors shrink-0"
              >
                ×
              </button> */}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
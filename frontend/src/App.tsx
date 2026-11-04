import { LOCATION_CONFIGS } from './types/types';
import { MemberManagement } from './components/MemberManagement';
import { ScheduleTable } from './components/ScheduleTable';
import { useEffect } from 'react';
import { useScheduleStore } from './types/useScheduleStore';
// Import your image
import lnhcbg from '../public/lnhcbg.jpg'; 

function App() {
  const fetchMembers = useScheduleStore((s) => s.fetchMembers);
  const fetchSchedules = useScheduleStore((s) => s.fetchSchedules);

  useEffect(() => {
    fetchMembers();
    fetchSchedules();
  }, [fetchMembers, fetchSchedules]);

  return (
    // Apply the image via inline style
    <div 
      className="min-h-screen bg-cover bg-center bg-fixed"
      style={{ backgroundImage: `url(${lnhcbg})` }}
    >
      <div className="min-h-screen bg-white/20 pb-12">
        <header className="bg-white border-b border-gray-200 py-6 px-8 mb-8 shadow-sm">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-black text-gray-900 tracking-tight">
                Lipa New Hope Church PnW Scheduling Website
              </h1>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 md:px-8">
          <MemberManagement />
          <div className="space-y-6">
            <ScheduleTable config={LOCATION_CONFIGS.LNHC} />
            <ScheduleTable config={LOCATION_CONFIGS.Tangway}/>
            <ScheduleTable config={LOCATION_CONFIGS.GarciaRosario}/>
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
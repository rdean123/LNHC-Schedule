import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AdminLayout } from '../components/layout/AdminLayout';
import { VolunteerLayout } from '../components/layout/VolunteerLayout';
import { ToastProvider } from '../components/ui/Toast';
import { AuthProvider } from './AuthProvider';
import { RouteEffects } from './RouteEffects';
import { ScheduleEditor } from '../features/scheduling/ScheduleEditor';
import { VolunteersManager } from '../features/volunteers/VolunteersManager';
import { HomeRedirect, RequireAdmin, RequireAuth, RequireStaff } from './guards';
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage';
import { ActivityPage } from './pages/staff/ActivityPage';
import { AnnouncementsPage } from './pages/staff/AnnouncementsPage';
import { MorePage } from './pages/staff/MorePage';
import { AvailabilityPage } from './pages/AvailabilityPage';
import { LoginPage } from './pages/LoginPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { ProfilePage } from './pages/ProfilePage';
import { SchedulesPage } from './pages/SchedulesPage';
import { SetPasswordPage } from './pages/SetPasswordPage';
import { VolunteerHomePage } from './pages/VolunteerHomePage';

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <RouteEffects />
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/accept-invite" element={<SetPasswordPage kind="invite" />} />
            <Route path="/reset-password" element={<SetPasswordPage kind="reset" />} />

            <Route element={<RequireAuth />}>
              <Route element={<VolunteerLayout />}>
                <Route
                  path="/"
                  element={
                    <HomeRedirect>
                      <VolunteerHomePage />
                    </HomeRedirect>
                  }
                />
                <Route path="/schedules" element={<SchedulesPage />} />
                <Route path="/availability" element={<AvailabilityPage />} />
                <Route path="/profile" element={<ProfilePage />} />

                {/* Schedule makers use the volunteer screens with edit tools added. */}
                <Route element={<RequireStaff />}>
                  <Route
                    path="/schedules/edit"
                    element={<ScheduleEditor finishLabel="Done editing" />}
                  />
                  <Route path="/people" element={<VolunteersManager />} />
                  <Route path="/announcements" element={<AnnouncementsPage />} />
                  <Route path="/activity" element={<ActivityPage />} />
                  <Route path="/more" element={<MorePage />} />
                </Route>
              </Route>

              <Route element={<RequireAdmin />}>
                <Route path="/admin" element={<AdminLayout />}>
                  <Route index element={<AdminDashboardPage />} />
                  <Route path="schedule" element={<ScheduleEditor />} />
                  <Route path="volunteers" element={<VolunteersManager />} />
                  <Route path="announcements" element={<AnnouncementsPage />} />
                  <Route path="activity" element={<ActivityPage />} />
                  <Route path="more" element={<MorePage />} />
                </Route>
              </Route>
            </Route>

            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}

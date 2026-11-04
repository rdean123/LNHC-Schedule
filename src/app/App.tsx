import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AdminLayout } from '../components/layout/AdminLayout';
import { VolunteerLayout } from '../components/layout/VolunteerLayout';
import { ToastProvider } from '../components/ui/Toast';
import { AuthProvider } from './AuthProvider';
import { HomeRedirect, RequireAdmin, RequireAuth } from './guards';
import { AdminActivityPage } from './pages/admin/AdminActivityPage';
import { AdminAnnouncementsPage } from './pages/admin/AdminAnnouncementsPage';
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage';
import { AdminMorePage } from './pages/admin/AdminMorePage';
import { AdminSchedulePage } from './pages/admin/AdminSchedulePage';
import { AdminVolunteersPage } from './pages/admin/AdminVolunteersPage';
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
              </Route>

              <Route element={<RequireAdmin />}>
                <Route path="/admin" element={<AdminLayout />}>
                  <Route index element={<AdminDashboardPage />} />
                  <Route path="schedule" element={<AdminSchedulePage />} />
                  <Route path="volunteers" element={<AdminVolunteersPage />} />
                  <Route path="announcements" element={<AdminAnnouncementsPage />} />
                  <Route path="activity" element={<AdminActivityPage />} />
                  <Route path="more" element={<AdminMorePage />} />
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

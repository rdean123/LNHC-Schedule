import path from 'node:path';
import { defineConfig } from 'vite';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import babel from '@rolldown/plugin-babel';
import tailwindcss from '@tailwindcss/vite';

const previewDir = path
  .resolve(import.meta.dirname, 'src/preview')
  .split(path.sep)
  .join('/');

// `npm run demo` (mode "demo") swaps every data service for an in-memory twin in src/preview,
// seeded with the church's real rosters, so the screens work without a Supabase project.
// Real builds never include any of it.
const serviceModules = [
  'authService',
  'catalogService',
  'volunteerService',
  'myProfileService',
  'availabilityService',
  'scheduleService',
  'inviteService',
  'roleService',
  'announcementService',
  'activityService',
].join('|');

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), babel({ presets: [reactCompilerPreset()] })],
  resolve:
    mode === 'demo'
      ? {
          alias: [
            {
              find: new RegExp(`^(?:\\.\\.?/)+(?:[\\w-]+/)*(${serviceModules})$`),
              replacement: `${previewDir}/$1`,
            },
          ],
        }
      : undefined,
}));

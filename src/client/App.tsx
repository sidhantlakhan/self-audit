import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { Landing } from './pages/Landing.tsx';
import { Loading, NotFound } from './components/ui.tsx';

// Everything except the landing page is code-split so first load stays small.
const Intake = lazy(() => import('./pages/Intake.tsx').then((m) => ({ default: m.Intake })));
const AssessmentApp = lazy(() => import('./pages/Assessment.tsx').then((m) => ({ default: m.AssessmentApp })));
const ResultPage = lazy(() => import('./pages/Result.tsx').then((m) => ({ default: m.ResultPage })));
const ResumeRequest = lazy(() => import('./pages/Resume.tsx').then((m) => ({ default: m.ResumeRequest })));
const Privacy = lazy(() => import('./pages/Privacy.tsx').then((m) => ({ default: m.Privacy })));
const AdminApp = lazy(() => import('./pages/admin/AdminApp.tsx').then((m) => ({ default: m.AdminApp })));

export function App() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/assessment" element={<Intake />} />
        <Route path="/resume" element={<ResumeRequest />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/a/:id/result" element={<ResultPage />} />
        <Route path="/a/:id/*" element={<AssessmentApp />} />
        <Route path="/admin/*" element={<AdminApp />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}

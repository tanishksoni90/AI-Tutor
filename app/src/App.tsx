import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { Toaster } from '@/components/ui/sonner';
import { ThemeProvider } from '@/components/ThemeProvider';
import { useAuthStore } from '@/store/authStore';
import { StudentRoute, AdminRoute } from '@/components/ProtectedRoute';

// Pages
import { Landing } from '@/pages/Landing';
import { Login } from '@/pages/Login';
import { AdminLogin } from '@/pages/AdminLogin';
import { AcceptInvitation } from '@/pages/AcceptInvitation';

// New ChatGPT-style student pages
import { DashboardPage } from '@/pages/DashboardPage';
import { ChatPage } from '@/pages/ChatPage';
import { SettingsPage } from '@/pages/SettingsPage';

// Admin Pages
import { 
  AdminOverview, 
  AdminUsers, 
  AdminCourses, 
  AdminDocuments, 
  AdminAnalytics, 
  AdminHealth,
  AdminSettings,
} from '@/pages/admin';

// Scroll to top on route change
function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    // Disable browser scroll restoration
    if ('scrollRestoration' in history) {
      history.scrollRestoration = 'manual';
    }
    // Scroll to top
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}

function App() {
  const { initAuth } = useAuthStore();

  useEffect(() => {
    initAuth();
    // Also scroll to top on initial load
    window.scrollTo(0, 0);
  }, []);

  return (
    <ThemeProvider>
      <BrowserRouter>
        <ScrollToTop />
        <AnimatePresence mode="wait">
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/accept-invitation" element={<AcceptInvitation />} />
            
            {/* Student Protected Routes — Two Modes */}
            <Route path="/dashboard" element={<StudentRoute><DashboardPage /></StudentRoute>} />
            <Route path="/doubt-clearing" element={<StudentRoute><ChatPage mode="doubt-clearing" /></StudentRoute>} />
            <Route path="/learning" element={<StudentRoute><ChatPage mode="learning" /></StudentRoute>} />
            {/* Legacy route redirects */}
            <Route path="/courses" element={<StudentRoute><Navigate to="/dashboard" replace /></StudentRoute>} />
            <Route path="/history" element={<StudentRoute><Navigate to="/dashboard" replace /></StudentRoute>} />
            <Route path="/chat/:courseId" element={<StudentRoute><Navigate to="/doubt-clearing" replace /></StudentRoute>} />
            <Route path="/settings" element={<StudentRoute><SettingsPage /></StudentRoute>} />
            
            {/* Admin Protected Routes */}
            <Route path="/admin" element={<AdminRoute><AdminOverview /></AdminRoute>} />
            <Route path="/admin/users" element={<AdminRoute><AdminUsers /></AdminRoute>} />
            <Route path="/admin/courses" element={<AdminRoute><AdminCourses /></AdminRoute>} />
            <Route path="/admin/documents" element={<AdminRoute><AdminDocuments /></AdminRoute>} />
            <Route path="/admin/analytics" element={<AdminRoute><AdminAnalytics /></AdminRoute>} />
            <Route path="/admin/health" element={<AdminRoute><AdminHealth /></AdminRoute>} />
            <Route path="/admin/settings" element={<AdminRoute><AdminSettings /></AdminRoute>} />
            
            {/* 404 */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AnimatePresence>
        <Toaster position="top-right" />
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;

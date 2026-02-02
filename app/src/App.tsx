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
import { Dashboard } from '@/pages/Dashboard';
import { Courses } from '@/pages/Courses';
import { ChatHistory } from '@/pages/ChatHistory';
import { Chat } from '@/pages/Chat';
import { Settings } from '@/pages/Settings';

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
            
            {/* Student Protected Routes */}
            <Route path="/dashboard" element={<StudentRoute><Dashboard /></StudentRoute>} />
            <Route path="/courses" element={<StudentRoute><Courses /></StudentRoute>} />
            <Route path="/history" element={<StudentRoute><ChatHistory /></StudentRoute>} />
            <Route path="/chat/:courseId" element={<StudentRoute><Chat /></StudentRoute>} />
            <Route path="/settings" element={<StudentRoute><Settings /></StudentRoute>} />
            
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

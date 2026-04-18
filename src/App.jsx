import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import PageTransition from './components/PageTransition';
import { useEffect } from 'react';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Shifts from './pages/Shifts';
import ShiftForm from './pages/ShiftForm';
import Employees from './pages/Employees';
import Flavors from './pages/Flavors';
import Inventory from './pages/Inventory';
import BaseMixingShiftForm from './pages/BaseMixingShiftForm';
import Availability from './pages/Availability';
import Schedule from './pages/Schedule';
import TimeTracking from './pages/TimeTracking';
import MyInfo from './pages/MyInfo';

const AnimatedRoutes = () => {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route element={<Layout />}>
          <Route path="/" element={<PageTransition><Schedule /></PageTransition>} />
          <Route path="/dashboard" element={<PageTransition><Dashboard /></PageTransition>} />
          <Route path="/shifts" element={<PageTransition><Shifts /></PageTransition>} />
          <Route path="/shifts/new" element={<PageTransition><ShiftForm /></PageTransition>} />
          <Route path="/shifts/edit" element={<PageTransition><ShiftForm /></PageTransition>} />
          <Route path="/employees" element={<PageTransition><Employees /></PageTransition>} />
          <Route path="/flavors" element={<PageTransition><Flavors /></PageTransition>} />
          <Route path="/inventory" element={<PageTransition><Inventory /></PageTransition>} />
          <Route path="/shifts/new-base-mix" element={<PageTransition><BaseMixingShiftForm /></PageTransition>} />
          <Route path="/shifts/edit-base-mix" element={<PageTransition><BaseMixingShiftForm /></PageTransition>} />
          <Route path="/availability" element={<PageTransition><Availability /></PageTransition>} />
          <Route path="/schedule" element={<PageTransition><Schedule /></PageTransition>} />
          <Route path="/time-tracking" element={<PageTransition><TimeTracking /></PageTransition>} />
          <Route path="/my-info" element={<PageTransition><MyInfo /></PageTransition>} />
          <Route path="*" element={<PageTransition><PageNotFound /></PageTransition>} />
        </Route>
      </Routes>
    </AnimatePresence>
  );
};

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Apply dark mode based on system preference
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = (e) => document.documentElement.classList.toggle("dark", e.matches);
    apply(mq);
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  return <AnimatedRoutes />;
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;
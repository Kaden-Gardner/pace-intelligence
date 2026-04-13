import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
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

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  // Render the main app
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Schedule />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/shifts" element={<Shifts />} />
        <Route path="/shifts/new" element={<ShiftForm />} />
        <Route path="/shifts/edit" element={<ShiftForm />} />
        <Route path="/employees" element={<Employees />} />
        <Route path="/flavors" element={<Flavors />} />
        <Route path="/inventory" element={<Inventory />} />
        <Route path="/shifts/new-base-mix" element={<BaseMixingShiftForm />} />
        <Route path="/shifts/edit-base-mix" element={<BaseMixingShiftForm />} />
        <Route path="/availability" element={<Availability />} />
        <Route path="/schedule" element={<Schedule />} />
        <Route path="/time-tracking" element={<TimeTracking />} />
        <Route path="/my-info" element={<MyInfo />} />
        <Route path="*" element={<PageNotFound />} />
      </Route>
    </Routes>
  );
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
  )
}

export default App
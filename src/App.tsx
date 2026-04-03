import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { DataProvider } from "@/contexts/DataContext";

import { cn } from "@/lib/utils";

import LanguageSelect from "./pages/LanguageSelect";
import Auth from "./pages/Auth";
import EmailVerification from "./pages/EmailVerification";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import DailyLog from "./pages/DailyLog";
import Behaviors from "./pages/Behaviors";
import Medications from "./pages/Medications";
import Summary from "./pages/Summary";
import Reports from "./pages/Reports";
import SharedReport from "./pages/SharedReport";
import NotFound from "./pages/NotFound";
import TherapistRegistration from "./pages/TherapistRegistration";
import TherapistVerificationPending from "./pages/TherapistVerificationPending";
import AdminDashboard from "./pages/AdminDashboard";
import TherapistDashboard from "./pages/TherapistDashboard";
import TherapistChildDetail from "./pages/TherapistChildDetail";
import TherapistAlerts from "./pages/TherapistAlerts";
import AppointmentBooking from "./pages/AppointmentBooking";
import TherapistSettings from "./pages/TherapistSettings";
import CaregiverProfile from "./pages/CaregiverProfile";
import TherapistProfile from "./pages/TherapistProfile";

import Sidebar from "@/components/Sidebar";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoading, isEmailVerified, user } = useAuth();
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }
  if (!isAuthenticated) return <Navigate to="/auth" replace />;
  // If user exists but email is not verified, redirect to verification page
  if (user && !isEmailVerified) {
    return <Navigate to="/verify-email" replace />;
  }
  return <>{children}</>;
};

const TherapistRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoading, userRole, therapistProfile } = useAuth();
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }
  if (!isAuthenticated) return <Navigate to="/auth" replace />;
  if (userRole !== 'therapist') return <Navigate to="/dashboard" replace />;
  if (therapistProfile && therapistProfile.verificationStatus !== 'verified') {
    return <Navigate to="/therapist/verification-pending" replace />;
  }
  return <>{children}</>;
};

const AppRoutes = () => {
  const { isAuthenticated, isOnboarded, userRole } = useAuth();
  const savedLanguage = localStorage.getItem('language');

  const getDefaultRoute = () => {
    if (userRole === 'therapist') return '/therapist/dashboard';
    return isOnboarded ? '/dashboard' : '/onboarding';
  };

  return (
    <Routes>
      <Route path="/" element={
        !savedLanguage ? (
          <LanguageSelect />
        ) : isAuthenticated ? (
          <Navigate to={getDefaultRoute()} replace />
        ) : (
          <Auth />
        )
      } />
      <Route path="/auth" element={isAuthenticated ? <Navigate to={getDefaultRoute()} replace /> : <Auth />} />
      <Route path="/verify-email" element={<EmailVerification />} />
      <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/daily-log" element={<ProtectedRoute><DailyLog /></ProtectedRoute>} />
      <Route path="/behaviors" element={<ProtectedRoute><Behaviors /></ProtectedRoute>} />
      <Route path="/medications" element={<ProtectedRoute><Medications /></ProtectedRoute>} />
      <Route path="/summary" element={<ProtectedRoute><Summary /></ProtectedRoute>} />
      <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><CaregiverProfile /></ProtectedRoute>} />
      {/* Therapist routes */}
      <Route path="/therapist/register" element={<TherapistRegistration />} />
      <Route path="/therapist/verification-pending" element={<TherapistVerificationPending />} />
      <Route path="/therapist/dashboard" element={<TherapistRoute><TherapistDashboard /></TherapistRoute>} />
      <Route path="/therapist/child/:childId" element={<TherapistRoute><TherapistChildDetail /></TherapistRoute>} />
      <Route path="/therapist/alerts" element={<TherapistRoute><TherapistAlerts /></TherapistRoute>} />
      <Route path="/therapist/settings" element={<TherapistRoute><TherapistSettings /></TherapistRoute>} />
      <Route path="/therapist/profile" element={<TherapistRoute><TherapistProfile /></TherapistRoute>} />
      {/* Appointment routes */}
      <Route path="/appointments" element={<ProtectedRoute><AppointmentBooking /></ProtectedRoute>} />
      {/* Admin routes removed per user request */}
      {/* Public read-only route for therapist access */}
      <Route path="/shared-report/:token" element={<SharedReport />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const Layout = ({ children }: { children: React.ReactNode }) => {
  const { userRole, isAuthenticated } = useAuth();
  const location = useLocation();

  // Sidebar visibility logic
  // Show only if authenticated AND (role is parent OR admin) AND not on public/auth pages
  const isPublicPath = ['/auth', '/therapist/register', '/verify-email', '/'].includes(location.pathname);
  const showSidebar = isAuthenticated && userRole === 'parent' && !isPublicPath;

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {showSidebar && <Sidebar />}
      <main className={cn("flex-1 w-full max-w-7xl mx-auto transition-all duration-300", showSidebar ? "md:ml-64" : "")}>
        {children}
      </main>
    </div>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <LanguageProvider>
      <AuthProvider>
        <DataProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
              <Layout>
                <AppRoutes />
              </Layout>
            </BrowserRouter>
          </TooltipProvider>
        </DataProvider>
      </AuthProvider>
    </LanguageProvider>
  </QueryClientProvider>
);

export default App;

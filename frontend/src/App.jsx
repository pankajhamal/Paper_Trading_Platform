// app.jsx
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAppStore } from './store/useAppStore'; // Global authentication store
import Dashboard from './pages/Dashboard';
import LandingPage from './pages/LandingPage';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import Orders from './components/dashboard/Orders'
import Portfolio from './components/dashboard/Portfolio';
import Market from './components/dashboard/Market';
import Watchlist from './components/dashboard/Watchlist';
import History from './components/dashboard/History';
import Settings from './components/dashboard/Settings';
import DashboardHome from './components/dashboard/DashboardHome';
import Charts from './components/dashboard/Charts';
import Alerts from './components/dashboard/Alerts';
import Wallet from './components/dashboard/Wallet';
import EBank from './components/dashboard/EBank';
import AdminDashboard from './pages/AdminDashboard';
import AdminOverview from './components/admin/AdminOverview';
import AdminUsers from './components/admin/AdminUsers';
import AdminWithdrawals from './components/admin/AdminWithdrawals';
import AdminFundRequests from './components/admin/AdminFundRequests';

// Route Guard for the trading workspace.
// Admins don't use the trading workspace — they're sent to the admin panel.
function ProtectedRoute({ children }) {
  const isAuthenticated = useAppStore((state) => state.isAuthenticated);
  const role = useAppStore((state) => state.user?.role);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (role === 'admin') return <Navigate to="/admin" replace />;
  return children;
}

// Admin-only guard: must be authenticated AND have the admin role.
// Non-admins are bounced to the trading workspace; guests to login.
function AdminRoute({ children }) {
  const isAuthenticated = useAppStore((state) => state.isAuthenticated);
  const role = useAppStore((state) => state.user?.role);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return role === 'admin' ? children : <Navigate to="/" replace />;
}

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-slate-50 text-slate-800">
        <Routes>
          {/* Public Landing Page */}
          <Route path="/welcome" element={<LandingPage />} />

          {/* Authentication Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          
          {/* Protected Workspace Routes inside Dashboard Shell */}
          <Route path="/" element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }>
            {/* Maps each sub-path to load inside the <Outlet /> in dashboard.jsx */}
            <Route index element={<DashboardHome />} />
            <Route path="portfolio" element={<Portfolio />} />
            <Route path='orders' element={<Orders />}/>
            {/* <Route path="orders" element={<TabContentPlaceholder />} /> */}
            <Route path="charts" element={<Charts />} />
            <Route path="market" element={<Market />} />
            <Route path="watchlist" element={<Watchlist />} />
            <Route path="history" element={<History />} />
            <Route path="ebank" element={<EBank />} />
            <Route path="wallet" element={<Wallet />} />
            <Route path="alerts" element={<Alerts />} />
            <Route path="settings" element={<Settings />} />
          </Route>

          {/* Admin Panel (role-gated) */}
          <Route path="/admin" element={
            <AdminRoute>
              <AdminDashboard />
            </AdminRoute>
          }>
            <Route index element={<AdminOverview />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="fund-requests" element={<AdminFundRequests />} />
            <Route path="withdrawals" element={<AdminWithdrawals />} />
          </Route>

          {/* Fallback Catch-All Route */}
          <Route path="*" element={<Navigate to="/welcome" replace />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
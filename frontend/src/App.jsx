// app.jsx
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAppStore } from './store/useAppStore'; // Global authentication store
import Dashboard from './pages/Dashboard';
import LandingPage from './pages/LandingPage';
import Login from './pages/Login';
import Register from './pages/Register';
import Orders from './components/dashboard/Orders'
import Portfolio from './components/dashboard/Portfolio';
import TabContentPlaceholder from './components/TabContentPlaceholder'; // Reusable helper for your views

// Route Guard
function ProtectedRoute({ children }) {
  const isAuthenticated = useAppStore((state) => state.isAuthenticated);
  return isAuthenticated ? children : <Navigate to="/login" replace />;
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
          
          {/* Protected Workspace Routes inside Dashboard Shell */}
          <Route path="/" element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }>
            {/* Maps each sub-path to load inside the <Outlet /> in dashboard.jsx */}
            <Route index element={<TabContentPlaceholder />} />
            <Route path="portfolio" element={<Portfolio />} />
            <Route path='orders' element={<Orders />}/>
            {/* <Route path="orders" element={<TabContentPlaceholder />} /> */}
            <Route path="charts" element={<TabContentPlaceholder />} />
            <Route path="market" element={<TabContentPlaceholder />} />
            <Route path="watchlist" element={<TabContentPlaceholder />} />
            <Route path="history" element={<TabContentPlaceholder />} />
            <Route path="alerts" element={<TabContentPlaceholder />} />
            <Route path="settings" element={<TabContentPlaceholder />} />
          </Route>

          {/* Fallback Catch-All Route */}
          <Route path="*" element={<Navigate to="/welcome" replace />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
// import Navbar from './components/layout/Navbar';
// import Dashboard from './pages/Dashboard';
// import Portfolio from './pages/Portfolio';
import LandingPage from './pages/LandingPage';
import Login from './pages/Login';
import Register from './pages/Register';

function LayoutWrapper({ children }) {
  const location = useLocation();
  const hideNavbarOn = ['/welcome', '/login', '/register']; 
  
  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      {!hideNavbarOn.includes(location.pathname) && <Navbar />}
      <main className="grow">
        {children}
      </main>
    </div>
  );
}

function App() {
  return (
    <Router>
      <LayoutWrapper>
        <Routes>
          {/* Landing / Welcome Page Route */}
          <Route path="/welcome" element={<LandingPage />} />

           {/* Authentication Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          
          {/* Workspace Routes */}
          {/* <Route path="/" element={<Dashboard />} />
          <Route path="/portfolio" element={<Portfolio />} /> */}
        </Routes>
      </LayoutWrapper>
    </Router>
  );
}

export default App;
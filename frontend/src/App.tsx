import React from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import './styles/theme.css';
import './index.css';

import Dashboard from './pages/Dashboard';
import Scheduling from './pages/Scheduling';
import Billing from './pages/Billing';
import History from './pages/History';
import Consent from './pages/Consent';
import Encounter from './pages/Encounter';
import Review from './pages/Review';
import TextToSoap from './pages/TextToSoap';
import Users from './pages/Users';
import Teleconsult from './pages/Teleconsult';
import TeleconsultList from './pages/TeleconsultList';
import DoctorLogin from './pages/DoctorLogin';

import Shell from './components/Shell';

const AnimatedRoutes = () => {
  const location = useLocation();
  const isStandalone = location.pathname === '/doctor-login';

  const routes = (
    <Routes location={location} key={location.pathname}>
      <Route path="/" element={<Dashboard />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/scheduling" element={<Scheduling />} />
      <Route path="/billing" element={<Billing />} />
      <Route path="/history" element={<History />} />
      <Route path="/consent" element={<Consent />} />
      <Route path="/encounter/:id" element={<Encounter />} />
      <Route path="/review/:id" element={<Review />} />
      <Route path="/teleconsultations" element={<TeleconsultList />} />
      <Route path="/teleconsult/:id" element={<Teleconsult />} />
      <Route path="/consult/:token" element={<Teleconsult />} />
      <Route path="/text-to-soap" element={<TextToSoap />} />
      <Route path="/users" element={<Users />} />
      <Route path="/doctor-login" element={<DoctorLogin />} />
    </Routes>
  );

  return (
    <AnimatePresence mode="wait">
      {isStandalone ? routes : <Shell>{routes}</Shell>}
    </AnimatePresence>
  );
};

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-slate-50 text-slate-900 selection:bg-blue-600/10">
        <AnimatedRoutes />
      </div>
    </Router>
  );
}

export default App;

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

import PipelineSimulator from './components/PipelineSimulator';
import Navbar from './components/Navbar';

const AnimatedRoutes = () => {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/scheduling" element={<Scheduling />} />
        <Route path="/billing" element={<Billing />} />
        <Route path="/history" element={<History />} />
        <Route path="/consent" element={<Consent />} />
        <Route path="/encounter/:id" element={<Encounter />} />
        <Route path="/review/:id" element={<Review />} />
        <Route path="/text-to-soap" element={<TextToSoap />} />
      </Routes>
    </AnimatePresence>
  );
};

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        <Navbar />
        <main className="flex-1">
          <PipelineSimulator />
          <AnimatedRoutes />
        </main>
      </div>
    </Router>
  );
}

export default App;

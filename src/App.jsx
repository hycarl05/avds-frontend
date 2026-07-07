import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import AvdsHeatPage from './pages/avds/AvdsHeatPage';
import Login from './pages/login/Login';
import { AuthProvider } from './context/AuthContext';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen bg-gray-900 flex flex-col">
          <Navbar />
          <main className="flex-1 w-full relative">
            <Routes>
              <Route path="/" element={<Navigate to="/avds-heat" replace />} />
              <Route path="/login" element={<Login />} />
              <Route path="/avds-heat" element={<AvdsHeatPage />} />
            </Routes>
          </main>
        </div>
      </Router>
      <ToastContainer position="top-right" autoClose={3000} theme="dark" />
    </AuthProvider>
  );
}

export default App;

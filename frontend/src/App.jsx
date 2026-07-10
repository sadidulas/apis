import React from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';
import Home from './Home';
import Docs from './Docs';
import Models from './Models';
import Playground from './Playground';
import Register from './Register';
import Login from './Login';
import UserDashboard from './UserDashboard';
import AdminLogin from './AdminLogin';
import AdminDashboard from './AdminDashboard';
import './App.css';

export default function App() {
  const location = useLocation();
  const hideFooter = location.pathname === '/playground';

  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/docs" element={<Docs />} />
        <Route path="/models" element={<Models />} />
        <Route path="/playground" element={<Playground />} />
        <Route path="/register" element={<Register />} />
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<UserDashboard />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin/*" element={<AdminDashboard />} />
      </Routes>
      {!hideFooter && <Footer />}
    </>
  );
}

import React from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Zap, Grid3X3, Beaker, BookOpen, LayoutDashboard, Shield, Key, LogOut } from 'lucide-react';

export default function Navbar() {
  const navigate = useNavigate();
  const userToken = localStorage.getItem('user_token');
  const adminToken = localStorage.getItem('admin_token');

  const handleUserLogout = () => {
    localStorage.removeItem('user_token');
    navigate('/');
  };

  const handleAdminLogout = () => {
    localStorage.removeItem('admin_token');
    navigate('/');
  };

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <Link to="/" className="navbar-brand">
          <div className="logo-mark"><Zap size={18} /></div>
          Free API
        </Link>
        <div className="navbar-links">
          <NavLink to="/" end><span>Home</span></NavLink>
          <NavLink to="/models"><Grid3X3 size={14} /><span>Models</span></NavLink>
          <NavLink to="/playground"><Beaker size={14} /><span>Playground</span></NavLink>
          <NavLink to="/docs"><BookOpen size={14} /><span>Docs</span></NavLink>
          {userToken ? (
            <>
              <NavLink to="/dashboard"><LayoutDashboard size={14} /><span>Dashboard</span></NavLink>
              <NavLink to="/dashboard" className="navbar-key-btn"><Key size={14} /><span>Create API Key</span></NavLink>
            </>
          ) : null}
          {adminToken ? (
            <NavLink to="/admin"><Shield size={14} /><span>Admin</span></NavLink>
          ) : null}
          {userToken ? (
            <button onClick={handleUserLogout}><LogOut size={14} /></button>
          ) : adminToken ? (
            <button onClick={handleAdminLogout}><LogOut size={14} /></button>
          ) : (
            <Link to="/login" className="navbar-cta">Sign In</Link>
          )}
        </div>
      </div>
    </nav>
  );
}

import React from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';

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
          <div className="logo-mark">F</div>
          Free API
        </Link>
        <div className="navbar-links">
          <NavLink to="/" end>Home</NavLink>
          <NavLink to="/models">Models</NavLink>
          <NavLink to="/playground">Playground</NavLink>
          <NavLink to="/docs">Docs</NavLink>
          {userToken ? (
            <NavLink to="/dashboard">Dashboard</NavLink>
          ) : null}
          {adminToken ? (
            <NavLink to="/admin">Admin</NavLink>
          ) : null}
          {userToken ? (
            <button onClick={handleUserLogout}>Logout</button>
          ) : adminToken ? (
            <button onClick={handleAdminLogout}>Logout</button>
          ) : (
            <Link to="/login" className="navbar-cta">Sign In</Link>
          )}
        </div>
      </div>
    </nav>
  );
}

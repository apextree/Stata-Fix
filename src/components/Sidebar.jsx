import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Sidebar.css';

const Sidebar = () => {
  const location = useLocation();
  const { user, logout, isAuthenticated } = useAuth();

  const handleLogout = () => {
    logout();
  };

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h2>StataFix</h2>
        <span className="political-elements">💻📊🔍📈</span>
        {isAuthenticated && (
          <div className="user-info">
            <span className="username">@{user.username}</span>
            <span className="user-points" style={{
              fontSize: '12px',
              color: 'var(--accent-indigo)',
              fontWeight: 'bold'
            }}>
              ⭐ {user.cumulative_points || 0} pts
            </span>
          </div>
        )}
      </div>

      <nav className="sidebar-nav">
        <Link
          to="/"
          className={`nav-item ${location.pathname === '/' ? 'active' : ''}`}
        >
          <span className="nav-icon">🏠</span>
          Home
        </Link>

        {isAuthenticated ? (
          <>
            <Link
              to="/polipions"
              className={`nav-item ${location.pathname === '/polipions' ? 'active' : ''}`}
            >
              <span className="nav-icon">🔍</span>
              Browse Issues
            </Link>

            <Link
              to="/my-polipions"
              className={`nav-item ${location.pathname === '/my-polipions' ? 'active' : ''}`}
            >
              <span className="nav-icon">📝</span>
              My Issues
            </Link>

            <Link
              to="/new"
              className={`nav-item ${location.pathname === '/new' ? 'active' : ''}`}
            >
              <span className="nav-icon">➕</span>
              Report Error
            </Link>

            <Link
              to="/leaderboard"
              className={`nav-item ${location.pathname === '/leaderboard' ? 'active' : ''}`}
            >
              <span className="nav-icon">🏆</span>
              Leaderboard
            </Link>
          </>
        ) : (
          <>
            <Link
              to="/login"
              className={`nav-item ${location.pathname === '/login' ? 'active' : ''}`}
            >
              <span className="nav-icon">🔑</span>
              Login
            </Link>

            <Link
              to="/register"
              className={`nav-item ${location.pathname === '/register' ? 'active' : ''}`}
            >
              <span className="nav-icon">👤</span>
              Register
            </Link>
          </>
        )}
      </nav>

      {isAuthenticated && (
        <div className="sidebar-footer">
          <button
            onClick={handleLogout}
            className="nav-item logout-btn"
          >
            <span className="nav-icon">🚪</span>
            Logout
          </button>
        </div>
      )}
    </div>
  );
};

export default Sidebar; 
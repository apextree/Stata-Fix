import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Home.css';

const Home = () => {
  const { isAuthenticated, user } = useAuth();

  return (
    <div className="home-container">
      <div className="welcome-section">
        <h1>Welcome to StataFix! 💻</h1>
        {isAuthenticated && user ? (
          <>
            <p className="welcome-text">
              Welcome back, @{user.username}! Ready to debug STATA errors? You have {user.cumulative_points || 0} points.
            </p>
            <div className="home-actions">
              <Link to="/polipions" className="home-btn primary">
                Browse Issues
              </Link>
              <Link to="/leaderboard" className="home-btn secondary">
                View Leaderboard
              </Link>
              <Link to="/new" className="home-btn secondary">
                Report Error
              </Link>
            </div>
          </>
        ) : (
          <>
            <p className="welcome-text">
              Your gamified platform to solve STATA errors together. Earn points by helping others debug their code!
            </p>
            <div className="home-actions">
              <Link to="/register" className="home-btn primary">
                Join StataFix
              </Link>
              <Link to="/login" className="home-btn secondary">
                Login
              </Link>
            </div>
          </>
        )}
        <div className="welcome-image">
          <span className="political-emoji">💻📊🔍📈</span>
        </div>
      </div>
    </div>
  );
};

export default Home; 

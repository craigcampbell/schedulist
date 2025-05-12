import React from 'react';
import { Link } from 'react-router-dom';
import './default.css';

const SignupDefault = () => {
  return (
    <div className="signup-container">
      <header className="auth-header">
        <nav>
          <div className="logo">Your App Name</div>
          <div className="auth-links">
            <Link to="/login" className="auth-link">Sign In</Link>
            <Link to="/signup" className="auth-button">Sign Up</Link>
          </div>
        </nav>
      </header>

      <main className="main-content">
        <h1>Welcome to Your App</h1>
        <p>Create an account to get started</p>
        {/* Add your main content/features here */}
      </main>
    </div>
  );
};

export default SignupDefault;

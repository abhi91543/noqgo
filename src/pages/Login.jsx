import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { auth } from '../firebaseConfig';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import './Auth.css'; // Assuming you have a shared CSS file for auth pages

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetMessage, setResetMessage] = useState('');
  const [resetError, setResetError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate('/management'); // Or to the appropriate dashboard
    } catch (err) {
      setError('Failed to log in. Please check your email and password.');
      console.error(err);
    }
    setLoading(false);
  };

  const handlePasswordReset = async (e) => {
    e.preventDefault();
    setResetError('');
    setResetMessage('');
    if (!resetEmail) {
      setResetError('Please enter your email address.');
      return;
    }
    try {
      await sendPasswordResetEmail(auth, resetEmail);
      setResetMessage('Password reset link sent! Please check your email inbox.');
    } catch (err) {
      setResetError('Failed to send reset email. Please check the email address.');
      console.error(err);
    }
  };

  const openResetModal = () => {
    setError('');
    setResetError('');
    setResetMessage('');
    setResetEmail('');
    setShowForgotPassword(true);
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2>Login to BuzzOrders</h2>
        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>
          {error && <p className="error-message">{error}</p>}
          <button type="submit" className="auth-button" disabled={loading}>
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
        <div className="auth-footer">
          <p>
            <button onClick={openResetModal} className="link-button">
              Forgot Password?
            </button>
          </p>
          <p>
            Don't have an account? <Link to="/signup">Sign Up</Link>
          </p>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotPassword && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Reset Your Password</h3>
              <button onClick={() => setShowForgotPassword(false)} className="close-btn">&times;</button>
            </div>
            <form onSubmit={handlePasswordReset}>
              <p>Enter your email address and we'll send you a link to reset your password.</p>
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                />
              </div>
              {resetMessage && <p style={{ color: 'green', marginTop: '1rem' }}>{resetMessage}</p>}
              {resetError && <p className="error-message">{resetError}</p>}
              <button type="submit" className="auth-button">Send Reset Link</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Login;
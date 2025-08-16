import { Routes, Route, Link } from 'react-router-dom';
import Home from './pages/Home';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import PantryView from './pages/PantryView';
import LandingPage from './pages/LandingPage';
import Profile from './pages/Profile';
import Admin from './pages/Admin';
import Venue from './pages/Venue';
import ProtectedRoute from './components/ProtectedRoute';
import AdminProtectedRoute from './components/AdminProtectedRoute';
import './App.css';
import { useState, useEffect } from 'react';
import { auth, db } from './firebaseConfig';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

function App() {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const userDocRef = doc(db, "users", currentUser.uid);
        const docSnap = await getDoc(userDocRef);
        if (docSnap.exists()) {
          setUserProfile(docSnap.data());
        }
      } else {
        setUserProfile(null);
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
    setUserProfile(null);
  };

  return (
    <div className="app-container">
      <nav className="navbar">
        <Link to="/" className="nav-logo">
          <img src="/logo.png" alt="NoQGo Logo" />
        </Link>
        <div className="nav-links">
          {user ? (
            <>
              <Link to="/profile">My Profile</Link>
              {userProfile?.role === 'owner' && (
                <>
                  <Link to="/dashboard">Dashboard</Link>
                  <Link to="/venue">My Venue</Link>
                  <Link to="/pantry">Pantry View</Link>
                </>
              )}
              <span className="user-email">{userProfile?.displayName || user.email}</span>
              <button onClick={handleLogout} className="logout-btn">Logout</button>
            </>
          ) : (
            <>
              <Link to="/login">Login</Link>
              <Link to="/signup" className="signup-button">Signup</Link>
            </>
          )}
        </div>
      </nav>

      <main className="main-content">
        <Routes>
          <Route path="/order/:ownerId/:screen/:seat" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/venue" element={<ProtectedRoute><Venue /></ProtectedRoute>} />
          <Route path="/pantry" element={<ProtectedRoute><PantryView /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/admin" element={<AdminProtectedRoute authLoading={authLoading}><Admin /></AdminProtectedRoute>} />
          <Route path="/" element={<LandingPage />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
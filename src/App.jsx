import { Routes, Route, Link, useNavigate } from 'react-router-dom';
import Home from './pages/Home';
import Login from './pages/Login';
import Signup from './pages/Signup';
import LandingPage from './pages/LandingPage';
import Profile from './pages/Profile';
import StaffView from './pages/StaffView';
import Management from './pages/Management';
import OrderPage from './pages/OrderPage';
import Admin from './pages/Admin';
import ProtectedRoute from './components/ProtectedRoute';
import AdminProtectedRoute from './components/AdminProtectedRoute';
import ReloadPrompt from './components/ReloadPrompt';
import './App.css';
import { useState, useEffect } from 'react';
import { auth, db } from './firebaseConfig';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import 'leaflet/dist/leaflet.css';

function App() {
  const [userProfile, setUserProfile] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        const userDocRef = doc(db, "users", currentUser.uid);
        const docSnap = await getDoc(userDocRef);
        setUserProfile(docSnap.exists() ? docSnap.data() : null);
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
    navigate('/');
  };

  const isOwner = userProfile?.role?.toLowerCase() === 'owner';
  const isStaff = userProfile?.role?.toLowerCase() === 'staff';
  const isSuperAdmin = userProfile?.role?.toLowerCase() === 'superadmin';

  return (
    <div className="app-container">
      <ReloadPrompt />
      <nav className="navbar">
        <Link to="/" className="nav-logo">
          <img src="/999orders-logo.png" alt="999orders Logo" />
        </Link>
        <div className="nav-links">
          {auth.currentUser ? (
            <>
              {/* --- THIS IS THE FIX --- */}
              {/* Show Management link to both Owners and Super Admins */}
              {(isOwner || isSuperAdmin) && (
                <Link to="/management">Management</Link>
              )}
              {/* --- END OF FIX --- */}
              
              {isSuperAdmin && (
                <Link to="/admin">Admin Panel</Link>
              )}
              {isStaff && ( <Link to="/staff-view">My Orders</Link> )}
              <Link to="/profile">My Profile</Link>
              <span className="user-email">{userProfile?.displayName || auth.currentUser.email}</span>
              <button onClick={handleLogout} className="logout-btn">Logout</button>
            </>
          ) : (
            (window.location.pathname !== '/login' && window.location.pathname !== '/signup') && (
              <>
                <Link to="/login">Login</Link>
                <Link to="/signup" className="signup-button">Signup</Link>
              </>
            )
          )}
        </div>
      </nav>

      <main className="main-content">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/order/:ownerId/:screen/:seat" element={<OrderPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/staff-view" element={<ProtectedRoute><StaffView /></ProtectedRoute>} />
          <Route path="/management" element={<AdminProtectedRoute userProfile={userProfile} authLoading={authLoading}><Management /></AdminProtectedRoute>} />
          <Route path="/admin" element={
            <AdminProtectedRoute userProfile={userProfile} authLoading={authLoading} requireSuperAdmin={true}>
              <Admin />
            </AdminProtectedRoute>
          } />
        </Routes>
      </main>
    </div>
  );
}

export default App;
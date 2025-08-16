import { Navigate } from 'react-router-dom';
import { auth } from '../firebaseConfig';

// Make sure this is your SUPER ADMIN User ID
const ADMIN_UID = "v9coxkgZAHWuNLHTGjLJLweDSC12"; 

const AdminProtectedRoute = ({ children, authLoading }) => {
  // If authentication is still loading, show a loading message
  if (authLoading) {
    return (
      <div className="page-container">
        <h1>Loading...</h1>
      </div>
    );
  }

  // After loading is done, then check for the user and their UID
  if (!auth.currentUser || auth.currentUser.uid !== ADMIN_UID) {
    return <Navigate to="/" />;
  }

  return children;
};

export default AdminProtectedRoute;
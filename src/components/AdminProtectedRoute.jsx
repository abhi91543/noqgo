import { Navigate } from 'react-router-dom';

const AdminProtectedRoute = ({ children, userProfile, authLoading, requireSuperAdmin = false }) => {
  
  // 1. అథెంటికేషన్ లోడ్ అవుతున్నప్పుడు, "Loading..." అని చూపించు
  if (authLoading) {
    return (
      <div className="page-container" style={{ textAlign: 'center' }}>
        <h1>Loading...</h1>
      </div>
    );
  }

  // 2. యూజర్ లాగిన్ అయి ఉండాలి మరియు వారికి ఒక ప్రొఫైల్ ఉండాలి
  if (!userProfile) {
    return <Navigate to="/login" />;
  }

  const role = userProfile.role?.toLowerCase();

  // 3. ఒకవేళ ఈ పేజీకి కచ్చితంగా Super Admin అవసరమైతే (ఉదా: /admin పేజీ)
  if (requireSuperAdmin) {
    if (role === 'superadmin') {
      return children; // Super Admin అయితే, పేజీని చూపించు
    } else {
      return <Navigate to="/" />; // ఇతరులను హోమ్ పేజీకి పంపు
    }
  }

  // 4. సాధారణ మేనేజ్‌మెంట్ పేజీల కోసం (/management)
  // యూజర్ 'owner' లేదా 'superadmin' అయితే, పేజీని చూపించు
  if (role === 'owner' || role === 'superadmin') {
    return children;
  }

  // ఏదీ కాకపోతే, హోమ్ పేజీకి పంపు
  return <Navigate to="/" />;
};

export default AdminProtectedRoute;
import { useState } from 'react'; 
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../firebaseConfig';
import { createUserWithEmailAndPassword, updateProfile, sendEmailVerification } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import './Auth.css';

function Signup() {
  const [accountType, setAccountType] = useState('customer'); // default customer
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [gender, setGender] = useState(''); 
  const [businessType, setBusinessType] = useState('');
  const navigate = useNavigate();

  const handleSignup = async (e) => {
    e.preventDefault();
    if (password.length < 6) {
      alert("Password should be at least 6 characters long.");
      return;
    }
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      await updateProfile(user, { displayName: name });

      // ✅ Save in users/{uid}
      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        displayName: name,
        email: user.email,
        phone: phone,
        gender: gender,
        role: accountType,   // "customer" or "owner"
        stampCount: 0,
        createdAt: serverTimestamp()
      });

      // ✅ If owner → also save in owners/{uid}
      if (accountType === 'owner') {
        await setDoc(doc(db, "owners", user.uid), {
          uid: user.uid,
          displayName: name,
          email: user.email,
          phone: phone,
          gender: gender,
          businessType: businessType,
          role: 'owner',
          stampCount: 0,
          createdAt: serverTimestamp()
        });
      }

      await sendEmailVerification(user);
      alert("Signup successful! Please check your email to verify your account.");
      navigate('/login');
    } catch (error) {
      alert(error.message);
    }
  };

  return (
    <div className="auth-page-container">
      <form className="auth-form" onSubmit={handleSignup}>
        <h2>Create Your Account</h2>

        <div className="form-group">
          <label htmlFor="accountType">Account Type</label>
          <select id="accountType" value={accountType} onChange={(e) => setAccountType(e.target.value)} required>
            <option value="customer">Customer</option>
            <option value="owner">Owner</option>
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="name">Full Name</label>
          <input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>

        <div className="form-group">
          <label htmlFor="email">Email</label>
          <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>

        <div className="form-group">
          <label htmlFor="phone">Phone Number</label>
          <input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required />
        </div>
        
        <div className="form-group">
          <label htmlFor="gender">Gender</label>
          <select id="gender" value={gender} onChange={(e) => setGender(e.target.value)} required>
            <option value="" disabled>-- Please select --</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>
        </div>

        {accountType === 'owner' && (
          <div className="form-group">
            <label htmlFor="businessType">Business Type</label>
            <select id="businessType" value={businessType} onChange={(e) => setBusinessType(e.target.value)} required>
              <option value="" disabled>-- Select Business --</option>
              <option value="theatre">Theatre</option>
              <option value="restaurant">Restaurant</option>
              <option value="shop">Shop</option>
            </select>
          </div>
        )}

        <div className="form-group">
          <label htmlFor="password">Password</label>
          <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>

        <button type="submit" className="auth-button">Create Account</button>
      </form>
    </div>
  );
}

export default Signup;

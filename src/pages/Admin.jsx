import { useState, useEffect } from 'react';
import { db } from '../firebaseConfig';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import './Admin.css';

function Admin() {
  const [users, setUsers] = useState([]);

  const fetchUsers = async () => {
    const querySnapshot = await getDocs(collection(db, "users"));
    const usersList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    setUsers(usersList);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleRoleChange = async (userId, newRole) => {
    const userDocRef = doc(db, "users", userId);
    await updateDoc(userDocRef, { role: newRole });
    fetchUsers(); // Refresh the list
  };

  const handleBusinessTypeChange = async (userId, newType) => {
    const userDocRef = doc(db, "users", userId);
    await updateDoc(userDocRef, { businessType: newType });
    fetchUsers(); // Refresh the list
  };

  return (
    <div className="page-container">
      <h1>Admin Panel</h1>
      <p>Manage all users and their roles.</p>
      
      <table className="user-list-table">
        <thead>
          <tr>
            <th>User Email</th>
            <th>Role</th>
            <th>Business Type</th>
          </tr>
        </thead>
        <tbody>
          {users.map(user => (
            <tr key={user.id}>
              <td>{user.email}</td>
              <td>
                <select value={user.role || 'customer'} onChange={(e) => handleRoleChange(user.id, e.target.value)}>
                  <option value="customer">Customer</option>
                  <option value="owner">Owner</option>
                </select>
              </td>
              <td>
                <select value={user.businessType || 'none'} onChange={(e) => handleBusinessTypeChange(user.id, e.target.value)}>
                  <option value="none">None</option>
                  <option value="theatre">Theatre</option>
                  <option value="cafe">Cafe</option>
                  <option value="restaurant">Restaurant</option>
                  <option value="hotel">Hotel</option>
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default Admin;
import React, { useState, useEffect, useMemo } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db, auth } from '../firebaseConfig'; // Import auth
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { DateRange } from 'react-date-range';
import { format, isWithinInterval } from 'date-fns';
import 'react-date-range/dist/styles.css';
import 'react-date-range/dist/theme/default.css';
import './StaffManagement.css';

function StaffManagement() {
  const [showForm, setShowForm] = useState(false);
  const [staffName, setStaffName] = useState('');
  const [staffEmail, setStaffEmail] = useState('');
  const [staffPhone, setStaffPhone] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [staffList, setStaffList] = useState([]);
  const [isStaffLoading, setIsStaffLoading] = useState(true);
  const [editingStaff, setEditingStaff] = useState(null);
  const [editedName, setEditedName] = useState('');
  const [editedPhone, setEditedPhone] = useState('');
  const [allOrders, setAllOrders] = useState([]);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [dateRange, setDateRange] = useState([
    { startDate: new Date(), endDate: new Date(), key: 'selection' }
  ]);

  useEffect(() => {
    const staffQuery = query(collection(db, "users"), where("role", "==", "staff"));
    const unsubscribe = onSnapshot(staffQuery, (snapshot) => {
      setStaffList(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setIsStaffLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (auth.currentUser) {
      const ordersQuery = query(collection(db, "Orders"), where("ownerId", "==", auth.currentUser.uid));
      const unsubscribe = onSnapshot(ordersQuery, (snapshot) => {
        setAllOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      });
      return () => unsubscribe();
    }
  }, []);

  const staffPerformanceStats = useMemo(() => {
    const startDate = new Date(dateRange[0].startDate);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(dateRange[0].endDate);
    endDate.setHours(23, 59, 59, 999);
    const filteredOrders = allOrders.filter(order => order.timestamp && isWithinInterval(order.timestamp.toDate(), { start: startDate, end: endDate }));
    const stats = filteredOrders.reduce((acc, order) => {
      if (order.assignedStaffId) {
        if (!acc[order.assignedStaffId]) {
          acc[order.assignedStaffId] = { ordersCompleted: 0, totalSales: 0 };
        }
        if (order.status === 'Delivered') {
          acc[order.assignedStaffId].ordersCompleted += 1;
          acc[order.assignedStaffId].totalSales += order.totalAmount;
        }
      }
      return acc;
    }, {});
    return stats;
  }, [allOrders, dateRange]);

  const handleAddStaff = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage('');
    try {
      const functions = getFunctions();
      const addOrPromoteStaff = httpsCallable(functions, 'addOrPromoteStaff');
      const result = await addOrPromoteStaff({ email: staffEmail, name: staffName, phone: staffPhone });
      if (result.data.success) {
        setMessage(result.data.message);
        setStaffName(''); setStaffEmail(''); setStaffPhone(''); setShowForm(false);
      }
    } catch (error) {
      setMessage('Error: ' + error.message);
    }
    setIsLoading(false);
  };

  const handleRemoveStaff = async (staffId, staffName) => {
    if (window.confirm(`Are you sure you want to remove ${staffName}?`)) {
      setIsLoading(true);
      setMessage(`Removing ${staffName}...`);
      try {
        const functions = getFunctions();
        const deleteStaffUser = httpsCallable(functions, 'deleteStaffUser');
        await deleteStaffUser({ uid: staffId });
        setMessage(`${staffName} has been removed.`);
      } catch (error) {
        setMessage('Error: ' + error.message);
      }
      setIsLoading(false);
    }
  };

  const handleEditClick = (staff) => {
    setEditingStaff(staff);
    setEditedName(staff.displayName);
    setEditedPhone(staff.phone || '');
  };

  const handleCloseModal = () => { setEditingStaff(null); };

  const handleUpdateStaff = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage('');
    try {
      const functions = getFunctions();
      const updateStaffUser = httpsCallable(functions, 'updateStaffUser');
      await updateStaffUser({ uid: editingStaff.id, displayName: editedName, phone: editedPhone });
      setMessage(`${editedName}'s profile has been updated.`);
      handleCloseModal();
    } catch (error) {
      setMessage('Error: ' + error.message);
    }
    setIsLoading(false);
  };

  return (
    <div className="page-container">
      <h1>Staff Management</h1>
      {!showForm && (<button onClick={() => setShowForm(true)} className="action-button">Add New Staff</button>)}
      {showForm && (
        <div className="staff-form-container">
          <h2>New Staff Member Details</h2>
          <form onSubmit={handleAddStaff}>
            <div className="form-group"><label htmlFor="staffName">Full Name</label><input id="staffName" type="text" value={staffName} onChange={(e) => setStaffName(e.target.value)} required /></div>
            <div className="form-group"><label htmlFor="staffEmail">Email</label><input id="staffEmail" type="email" value={staffEmail} onChange={(e) => setStaffEmail(e.target.value)} required /></div>
            <div className="form-group"><label htmlFor="staffPhone">Phone Number (Optional)</label><input id="staffPhone" type="tel" value={staffPhone} onChange={(e) => setStaffPhone(e.target.value)} /></div>
            <div className="form-actions"><button type="submit" className="action-button" disabled={isLoading}>{isLoading ? 'Processing...' : 'Add or Promote Staff'}</button><button type="button" className="secondary-button" onClick={() => setShowForm(false)}>Cancel</button></div>
          </form>
        </div>
      )}
      {message && <p className="feedback-message">{message}</p>}
      <hr style={{ margin: '40px 0' }} />
      <div className="performance-header">
        <h2>Current Staff Performance</h2>
        <div className="date-picker-container">
          <button className="date-picker-button" onClick={() => setShowDatePicker(!showDatePicker)}>
            {`${format(dateRange[0].startDate, 'MMM d, yyyy')} - ${format(dateRange[0].endDate, 'MMM d, yyyy')}`}
          </button>
          {showDatePicker && (
            <div className="date-picker-wrapper"><DateRange editableDateInputs={true} onChange={item => { setDateRange([item.selection]); setShowDatePicker(false); }} moveRangeOnFirstSelection={false} ranges={dateRange} maxDate={new Date()} /></div>
          )}
        </div>
      </div>
      {isStaffLoading ? (<p>Loading staff list...</p>) : (
        <table className="staff-table">
          <thead><tr><th>Name</th><th>Email</th><th>Orders Completed</th><th>Total Sales</th><th>Actions</th></tr></thead>
          <tbody>
            {staffList.map(staff => {
              const stats = staffPerformanceStats[staff.id] || { ordersCompleted: 0, totalSales: 0 };
              return (
                <tr key={staff.id}>
                  <td>{staff.displayName}</td><td>{staff.email}</td><td>{stats.ordersCompleted}</td><td>₹{stats.totalSales.toFixed(2)}</td>
                  <td>
                    <button onClick={() => handleEditClick(staff)} className="edit-btn" disabled={isLoading}>Edit</button>
                    <button onClick={() => handleRemoveStaff(staff.id, staff.displayName)} className="delete-btn" disabled={isLoading}>Remove</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {editingStaff && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <h2>Edit Staff: {editingStaff.displayName}</h2>
            <form onSubmit={handleUpdateStaff}>
              <div className="form-group"><label>Email (Cannot be changed)</label><input type="email" value={editingStaff.email} disabled /></div>
              <div className="form-group"><label htmlFor="editedName">Full Name</label><input id="editedName" type="text" value={editedName} onChange={(e) => setEditedName(e.target.value)} required /></div>
              <div className="form-group"><label htmlFor="editedPhone">Phone Number</label><input id="editedPhone" type="tel" value={editedPhone} onChange={(e) => setEditedPhone(e.target.value)} /></div>
              <div className="form-actions"><button type="submit" className="action-button" disabled={isLoading}>{isLoading ? 'Saving...' : 'Save Changes'}</button><button type="button" className="secondary-button" onClick={handleCloseModal}>Cancel</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default StaffManagement;
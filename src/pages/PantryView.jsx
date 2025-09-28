import React, { useState, useEffect, useMemo } from 'react';
import { db, auth } from '../firebaseConfig';
import { collection, query, where, onSnapshot, orderBy, doc, updateDoc, getDocs, documentId } from 'firebase/firestore';
import { DateRange } from 'react-date-range';
import { format, isWithinInterval } from 'date-fns';
import 'react-date-range/dist/styles.css';
import 'react-date-range/dist/theme/default.css';
import './PantryView.css';

function PantryView() {
  const [view, setView] = useState('new');
  const [newOrders, setNewOrders] = useState([]);
  const [allOrders, setAllOrders] = useState([]);
  const [usersMap, setUsersMap] = useState({});
  const [staffMap, setStaffMap] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [dateRange, setDateRange] = useState([{ startDate: new Date(), endDate: new Date(), key: 'selection' }]);

  useEffect(() => {
    if (auth.currentUser) {
      const q = query(collection(db, "Orders"), where("ownerId", "==", auth.currentUser.uid), where("status", "in", ["Paid - New Order", "Paid - Unassigned", "Paid - Assigned", "Preparing"]), orderBy("timestamp", "asc"));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setNewOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      });
      return () => unsubscribe();
    }
  }, []);

  useEffect(() => {
    if (view === 'history' && auth.currentUser) {
      const q = query(collection(db, "Orders"), where("ownerId", "==", auth.currentUser.uid), orderBy("timestamp", "desc"));
      const unsubscribe = onSnapshot(q, snapshot => {
        setAllOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      });
      return () => unsubscribe();
    }
  }, [view]);

  useEffect(() => {
    if (allOrders.length === 0) return;
    const userIds = [...new Set(allOrders.map(order => order.customerId).filter(Boolean))];
    if (userIds.length > 0) {
      const usersQuery = query(collection(db, "users"), where(documentId(), "in", userIds));
      getDocs(usersQuery).then(snapshot => {
        const usersData = snapshot.docs.reduce((acc, doc) => {
          acc[doc.id] = doc.data().displayName;
          return acc;
        }, {});
        setUsersMap(usersData);
      });
    }
  }, [allOrders]);
  
  useEffect(() => {
    const staffQuery = query(collection(db, "users"), where("role", "==", "staff"));
    const unsubscribe = onSnapshot(staffQuery, (snapshot) => {
      const staffData = snapshot.docs.reduce((acc, doc) => {
        acc[doc.id] = doc.data().displayName;
        return acc;
      }, {});
      setStaffMap(staffData);
    });
    return () => unsubscribe();
  }, []);

  const filteredHistory = useMemo(() => {
    const startDate = new Date(dateRange[0].startDate);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(dateRange[0].endDate);
    endDate.setHours(23, 59, 59, 999);
    return allOrders.filter(order => {
      const orderDate = order.timestamp?.toDate();
      if (!orderDate) return false;
      const isInRange = isWithinInterval(orderDate, { start: startDate, end: endDate });
      const customerName = usersMap[order.customerId] || '';
      const matchesSearch = 
        (order.customerEmail || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (customerName).toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.items.some(item => item.ItemName.toLowerCase().includes(searchTerm.toLowerCase()));
      return isInRange && matchesSearch;
    });
  }, [allOrders, searchTerm, dateRange, usersMap]);

  const updateOrderStatus = async (orderId, newStatus) => {
    const orderDocRef = doc(db, 'Orders', orderId);
    await updateDoc(orderDocRef, { status: newStatus });
  };

  return (
    <div className="page-container">
      <h1>Pantry View</h1>
      <div className="pantry-tabs">
        <button onClick={() => setView('new')} className={view === 'new' ? 'active' : ''}>New Orders ({newOrders.length})</button>
        <button onClick={() => setView('history')} className={view === 'history' ? 'active' : ''}>Order History</button>
      </div>
      {view === 'new' && (
        <div className="orders-grid">
          {newOrders.map(order => (
            <div key={order.id} className="order-card">
              <h3>Screen: {order.screen}, Seat: {order.seat}</h3>
              <p>Order Time: {new Date(order.timestamp?.toDate()).toLocaleTimeString()}</p>
              <ul>{order.items.map((item, index) => <li key={index}>{item.ItemName} x {item.quantity}</li>)}</ul>
              <div className="order-card-footer">
                <h4>Total: ₹{order.totalAmount}</h4>
                <button onClick={() => updateOrderStatus(order.id, 'Delivered')} className="mark-done-btn">Mark as Delivered</button>
              </div>
            </div>
          ))}
        </div>
      )}
      {view === 'history' && (
        <div className="history-container">
          <div className="history-filters">
            <input type="text" placeholder="Search by customer or item..." className="search-input" onChange={(e) => setSearchTerm(e.target.value)} />
            <button className="date-picker-button" onClick={() => setShowDatePicker(!showDatePicker)}>
              {`${format(dateRange[0].startDate, 'MMM d, yyyy')} - ${format(dateRange[0].endDate, 'MMM d, yyyy')}`}
            </button>
            {showDatePicker && (
              <div className="date-picker-wrapper"><div className="date-picker-popover">
                <DateRange
                  editableDateInputs={true}
                  onChange={item => { setDateRange([item.selection]); setShowDatePicker(false); }}
                  moveRangeOnFirstSelection={false}
                  ranges={dateRange}
                  maxDate={new Date()}
                />
              </div></div>
            )}
          </div>
          <table className="history-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Details</th>
                <th>Items</th>
                <th>Total</th>
                <th>Date</th>
                <th>Status</th>
                <th>Assigned To</th>
              </tr>
            </thead>
            <tbody>
              {filteredHistory.map(order => (
                <tr key={order.id}>
                  <td>{usersMap[order.customerId] || order.customerEmail}</td>
                  <td>{order.screen ? `Screen ${order.screen}, Seat ${order.seat}` : `Table ${order.table}`}</td>
                  <td>{order.items.map(i => `${i.ItemName} x${i.quantity}`).join(', ')}</td>
                  <td>₹{order.totalAmount.toFixed(2)}</td>
                  <td>{new Date(order.timestamp?.toDate()).toLocaleString()}</td>
                  <td>{order.status}</td>
                  <td>{staffMap[order.assignedStaffId] || 'Unassigned'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default PantryView;
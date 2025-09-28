import React, { useState, useEffect, useMemo } from 'react';
import { db, auth } from '../firebaseConfig';
import { collection, query, where, onSnapshot, orderBy, doc, updateDoc, limit } from 'firebase/firestore';
import { DateRange } from 'react-date-range';
import { format, isWithinInterval } from 'date-fns';
import 'react-date-range/dist/styles.css';
import 'react-date-range/dist/theme/default.css';
import './PantryView.css';

function StaffView() {
  const [newOrders, setNewOrders] = useState([]);
  const [allCompletedOrders, setAllCompletedOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [dateRange, setDateRange] = useState([{ startDate: new Date(), endDate: new Date(), key: 'selection' }]);
  const currentUser = auth.currentUser;

  useEffect(() => {
    if (!currentUser) return;

    const newOrdersQuery = query(collection(db, "Orders"), where("assignedStaffId", "==", currentUser.uid), where("status", "in", ["Paid - Assigned", "Preparing"]));
    const unsubscribeNew = onSnapshot(newOrdersQuery, (snapshot) => {
      setNewOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setIsLoading(false);
    });

    const completedOrdersQuery = query(collection(db, "Orders"), where("assignedStaffId", "==", currentUser.uid), where("status", "==", "Delivered"), orderBy("timestamp", "desc"));
    const unsubscribeCompleted = onSnapshot(completedOrdersQuery, (snapshot) => {
      setAllCompletedOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => { unsubscribeNew(); unsubscribeCompleted(); };
  }, [currentUser]);

  const performanceData = useMemo(() => {
    const startDate = new Date(dateRange[0].startDate);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(dateRange[0].endDate);
    endDate.setHours(23, 59, 59, 999);
    const filteredOrders = allCompletedOrders.filter(order => order.timestamp && isWithinInterval(order.timestamp.toDate(), { start: startDate, end: endDate }));
    const stats = filteredOrders.reduce((acc, order) => {
      acc.ordersCompleted += 1;
      acc.totalSales += order.totalAmount;
      return acc;
    }, { ordersCompleted: 0, totalSales: 0 });
    return { filteredOrders, stats };
  }, [allCompletedOrders, dateRange]);

  const updateOrderStatus = async (orderId, newStatus) => {
    await updateDoc(doc(db, 'Orders', orderId), { status: newStatus });
  };

  if (isLoading && newOrders.length === 0) {
    return <div className="page-container"><p>Loading your orders...</p></div>;
  }

  return (
    <div className="page-container">
      <div className="staff-view-header">
        <h1>My Dashboard</h1>
        <p>Welcome! Here are your assigned orders and performance stats.</p>
      </div>
      
      <h2>New Orders ({newOrders.length})</h2>
      <div className="orders-grid">
        {newOrders.length > 0 ? newOrders.map(order => (
          <div key={order.id} className="order-card">
            <h3>Screen: {order.screen}, Seat: {order.seat}</h3>
            <p>Order Time: {new Date(order.timestamp?.toDate()).toLocaleTimeString()}</p>
            <ul>{order.items.map((item, index) => <li key={index}>{item.ItemName} x {item.quantity}</li>)}</ul>
            <div className="order-card-footer">
              <h4>Total: ₹{order.totalAmount}</h4>
              <button onClick={() => updateOrderStatus(order.id, 'Delivered')} className="mark-done-btn">Mark as Delivered</button>
            </div>
          </div>
        )) : <p>No new orders assigned to you. Great job!</p>}
      </div>

      <section className="performance-section">
        <div className="performance-header">
          <h2>My Performance & History</h2>
          <div className="date-picker-container">
            <button className="date-picker-button" onClick={() => setShowDatePicker(!showDatePicker)}>
              {`${format(dateRange[0].startDate, 'MMM d, yyyy')} - ${format(dateRange[0].endDate, 'MMM d, yyyy')}`}
            </button>
            {showDatePicker && (
              <div className="date-picker-wrapper"><DateRange editableDateInputs={true} onChange={item => { setDateRange([item.selection]); setShowDatePicker(false); }} moveRangeOnFirstSelection={false} ranges={dateRange} maxDate={new Date()} /></div>
            )}
          </div>
        </div>
        <div className="stats-grid">
          <div className="stat-card"><h4>Orders Completed</h4><p>{performanceData.stats.ordersCompleted}</p></div>
          <div className="stat-card"><h4>Total Sales</h4><p>₹{performanceData.stats.totalSales.toFixed(2)}</p></div>
        </div>
        <table className="history-table">
          <thead><tr><th>Details</th><th>Items</th><th>Total</th><th>Date</th></tr></thead>
          <tbody>
            {performanceData.filteredOrders.length > 0 ? performanceData.filteredOrders.map(order => (
              <tr key={order.id}>
                <td>{order.screen ? `Screen ${order.screen}, Seat ${order.seat}` : `Table ${order.table}`}</td>
                <td>{order.items.map(i => `${i.ItemName} x${i.quantity}`).join(', ')}</td>
                <td>₹{order.totalAmount}</td>
                <td>{new Date(order.timestamp?.toDate()).toLocaleString()}</td>
              </tr>
            )) : <tr><td colSpan="4">No completed orders in this period.</td></tr>}
          </tbody>
        </table>
      </section>
    </div>
  );
}

export default StaffView;
import { useState, useEffect, useMemo } from 'react';
import { db, auth } from '../firebaseConfig';
import { collection, query, where, onSnapshot, orderBy, doc, updateDoc, getDocs } from 'firebase/firestore';
import { DateRange } from 'react-date-range';
import { addDays, format, isWithinInterval } from 'date-fns';
import 'react-date-range/dist/styles.css';
import 'react-date-range/dist/theme/default.css';
import './PantryView.css';

function PantryView() {
  const [view, setView] = useState('new');
  const [newOrders, setNewOrders] = useState([]);
  const [allOrders, setAllOrders] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [dateRange, setDateRange] = useState([
    { startDate: addDays(new Date(), -6), endDate: new Date(), key: 'selection' }
  ]);

  useEffect(() => {
    if (auth.currentUser) {
      const q = query(collection(db, "Orders"), where("ownerId", "==", auth.currentUser.uid), where("status", "==", "Paid - New Order"), orderBy("timestamp", "asc"));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setNewOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      });
      return () => unsubscribe();
    }
  }, []);

  useEffect(() => {
    if (view === 'history' && auth.currentUser) {
      const q = query(collection(db, "Orders"), where("ownerId", "==", auth.currentUser.uid), orderBy("timestamp", "desc"));
      getDocs(q).then(snapshot => {
        setAllOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      });
    }
  }, [view]);

  const filteredHistory = useMemo(() => {
    return allOrders.filter(order => {
      const orderDate = order.timestamp.toDate();
      const isInRange = isWithinInterval(orderDate, { start: dateRange[0].startDate, end: dateRange[0].endDate });
      const matchesSearch = (order.customerEmail || '').toLowerCase().includes(searchTerm.toLowerCase()) || order.items.some(item => item.ItemName.toLowerCase().includes(searchTerm.toLowerCase()));
      return isInRange && matchesSearch;
    });
  }, [allOrders, searchTerm, dateRange]);

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
            <input type="text" placeholder="Search by customer email or item..." className="search-input" onChange={(e) => setSearchTerm(e.target.value)} />
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
            <thead><tr><th>Customer</th><th>Details</th><th>Items</th><th>Total</th><th>Date</th><th>Status</th></tr></thead>
            <tbody>
              {filteredHistory.map(order => (
                <tr key={order.id}>
                  <td>{order.customerEmail}</td>
                  <td>{order.screen ? `Screen ${order.screen}, Seat ${order.seat}` : `Table ${order.table}`}</td>
                  <td>{order.items.map(i => `${i.ItemName} x${i.quantity}`).join(', ')}</td>
                  <td>₹{order.totalAmount}</td>
                  <td>{new Date(order.timestamp?.toDate()).toLocaleString()}</td>
                  <td>{order.status}</td>
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
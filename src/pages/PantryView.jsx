import { useState, useEffect, useRef } from 'react';
import { db, auth } from '../firebaseConfig';
import { collection, query, where, onSnapshot, orderBy, doc, updateDoc } from 'firebase/firestore';

function PantryView() {
  const [newOrders, setNewOrders] = useState([]);
  const isInitialLoad = useRef(true);

  useEffect(() => {
    if (!auth.currentUser) return;

    // THE FIX IS HERE: We are now looking for the correct status
    const q = query(
      collection(db, "Orders"),
      where("ownerId", "==", auth.currentUser.uid),
      where("status", "==", "Paid - New Order"), // <-- CORRECTED STATUS
      orderBy("timestamp", "asc")
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const ordersList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setNewOrders(ordersList);

      if (isInitialLoad.current) {
        isInitialLoad.current = false;
      } else if (querySnapshot.docChanges().some(change => change.type === 'added')) {
        const audio = new Audio('/notification.mp3');
        audio.play().catch(error => console.error("Error playing sound:", error));
      }
    });

    return () => unsubscribe();
  }, []);

  const updateOrderStatus = async (orderId, newStatus) => {
    const orderDocRef = doc(db, 'Orders', orderId);
    try {
      await updateDoc(orderDocRef, { status: newStatus });
      console.log(`Order ${orderId} status updated to ${newStatus}`);
    } catch (error) {
      console.error("Error updating order status: ", error);
      alert("Failed to update status.");
    }
  };

  return (
    <div className="page-container">
      <h1>Pantry - New Orders</h1>
      <div className="orders-grid">
        {newOrders.length > 0 ? (
          newOrders.map(order => (
            <div key={order.id} className="order-card">
              <h3>Screen: {order.screen}, Seat: {order.seat}</h3>
              <p>Order Time: {new Date(order.timestamp?.toDate()).toLocaleTimeString()}</p>
              <ul>
                {order.items.map(item => (
                  <li key={item.id}>
                    {item.ItemName} - x{item.quantity}
                  </li>
                ))}
              </ul>
              <div className="order-card-footer">
                <h4>Total: ₹{order.totalAmount}</h4>
                <button onClick={() => updateOrderStatus(order.id, 'Delivered')} className="mark-done-btn">
                  Mark as Delivered
                </button>
              </div>
            </div>
          ))
        ) : (
          <p>No new orders at the moment.</p>
        )}
      </div>
    </div>
  );
}

export default PantryView;
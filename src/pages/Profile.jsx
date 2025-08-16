import { useState, useEffect } from 'react';
import { auth, db } from '../firebaseConfig';
import { doc, getDoc, collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import './Profile.css';

// A new component for the accordion
function AccordionItem({ title, orders }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="business-group">
      <button className="business-name-accordion" onClick={() => setIsOpen(!isOpen)}>
        <span style={{ textTransform: 'capitalize' }}>{title.replace(/-/g, ' ')}</span>
        <span>{isOpen ? '−' : '+'}</span>
      </button>
      {isOpen && (
        <div className="accordion-content">
          {orders.map(order => (
            <div key={order.id} className="order-summary-card">
              <div className="order-summary-header">
                <span>Order Date: {new Date(order.timestamp?.toDate()).toLocaleDateString()}</span>
                <span>Total: ₹{order.totalAmount}</span>
              </div>
              <ul>
                {order.items.map((item, index) => (
                  <li key={index}>{item.ItemName} x {item.quantity}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Profile() {
  const [userProfile, setUserProfile] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserData = async (currentUser) => {
      try {
        // Fetch user profile
        const userDocRef = doc(db, "users", currentUser.uid);
        const docSnap = await getDoc(userDocRef);
        if (docSnap.exists()) setUserProfile(docSnap.data());

        // Fetch user orders
        const ordersQuery = query(
          collection(db, "Orders"),
          where("customerId", "==", currentUser.uid),
          orderBy("timestamp", "desc")
        );
        const querySnapshot = await getDocs(ordersQuery);
        const ordersList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setOrders(ordersList);
      } catch (error) {
        console.error("Error fetching user data:", error);
      } finally {
        setLoading(false);
      }
    };

    const unsubscribe = auth.onAuthStateChanged(user => {
      if (user) {
        fetchUserData(user);
      } else {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);
  
  // Group orders by businessId
  const groupedOrders = orders.reduce((acc, order) => {
    const key = order.businessId || 'General';
    if (!acc[key]) acc[key] = [];
    acc[key].push(order);
    return acc;
  }, {});

  if (loading) return <div className="page-container"><h2>Loading Profile...</h2></div>;
  if (!userProfile) return <div className="page-container"><h2>Could not load profile. Please log in.</h2></div>;

  const totalStampsNeeded = 10;
  const currentStampCount = userProfile.stampCount % totalStampsNeeded;
  const progressPercentage = (currentStampCount / totalStampsNeeded) * 100;

  return (
    <div className="profile-page-container">
      <h1>My Profile</h1>
      <div className="rewards-card">
        <h3>Welcome, {userProfile.displayName}!</h3>
        <p className="progress-text">
          You have completed **{currentStampCount}** of {totalStampsNeeded} orders for your next reward.
        </p>
        <div className="progress-bar-background">
            <div className="progress-bar-foreground" style={{ width: `${progressPercentage}%` }}></div>
        </div>
      </div>

      <div className="order-history">
        <h2>My Order History</h2>
        {Object.keys(groupedOrders).length > 0 ? (
          Object.keys(groupedOrders).map(businessId => (
            <AccordionItem key={businessId} title={businessId} orders={groupedOrders[businessId]} />
          ))
        ) : (
          <p>You haven't placed any orders yet.</p>
        )}
      </div>
    </div>
  );
}

export default Profile;
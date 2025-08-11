import { useState, useEffect } from 'react';
import { auth, db } from '../firebaseConfig';
import { doc, getDoc, collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import './Profile.css';

function Profile() {
  const [userProfile, setUserProfile] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserData = async () => {
      const currentUser = auth.currentUser;
      if (currentUser) {
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
      }
      setLoading(false);
    };

    const unsubscribe = auth.onAuthStateChanged(user => {
      if (user) fetchUserData();
      else setLoading(false);
    });

    return () => unsubscribe();
  }, []);
  
  // Group orders by businessId
  const groupedOrders = orders.reduce((acc, order) => {
    const key = order.businessId || 'Other';
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(order);
    return acc;
  }, {});

  if (loading) return <div className="page-container"><h2>Loading Profile...</h2></div>;
  if (!userProfile) return <div className="page-container"><h2>Could not load profile.</h2></div>;

  const totalStampsNeeded = 10;
  const currentStampCount = userProfile.stampCount % totalStampsNeeded;
  const progressPercentage = (currentStampCount / totalStampsNeeded) * 100;

  return (
    <div className="profile-page-container">
      <h1>My Profile</h1>
      {/* --- REWARDS CARD --- */}
      <div className="rewards-card">
        <h3>Welcome, {userProfile.displayName}!</h3>
        <p className="progress-text">
          You have completed **{currentStampCount}** of {totalStampsNeeded} orders for your next reward.
        </p>
        <div className="progress-bar-background">
            <div className="progress-bar-foreground" style={{ width: `${progressPercentage}%` }}></div>
        </div>
      </div>

      {/* --- ORDER HISTORY --- */}
      <div className="order-history">
        <h2>My Order History</h2>
        {Object.keys(groupedOrders).length > 0 ? (
          Object.keys(groupedOrders).map(businessId => (
            <div key={businessId} className="business-group">
              <h3 className="business-name">{businessId.replace(/-/g, ' ')}</h3>
              {groupedOrders[businessId].map(order => (
                <div key={order.id} className="order-summary-card">
                  <div className="order-summary-header">
                    <span>Order Date: {new Date(order.timestamp?.toDate()).toLocaleDateString()}</span>
                    <span>Total: ₹{order.totalAmount}</span>
                  </div>
                  <ul>
                    {order.items.map(item => (
                      <li key={item.id}>{item.ItemName} x {item.quantity}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ))
        ) : (
          <p>You haven't placed any orders yet.</p>
        )}
      </div>
    </div>
  );
}

export default Profile;
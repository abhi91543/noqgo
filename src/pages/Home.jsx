import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { db, auth } from '../firebaseConfig';
import { collection, getDocs, addDoc, serverTimestamp, doc, updateDoc, increment, query, where } from 'firebase/firestore';

// --- PASTE YOUR KEYS AND URLS HERE ---

const RAZORPAY_KEY_ID = "rzp_test_Sau6n14kXnINu7"; 
const FUNCTION_URL = "https://us-central1-theatre-pantry.cloudfunctions.net/createRazorpayOrder";
// -----------------------------------------

function Home() {
  const { ownerId, screen, seat } = useParams();
  const [menuItems, setMenuItems] = useState([]);
  const [cart, setCart] = useState([]);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (!ownerId) return;
    const fetchMenu = async () => {
      // This query now fetches ONLY the menu for the specific owner
      const q = query(collection(db, "Menu"), where("ownerId", "==", ownerId));
      const menuSnapshot = await getDocs(q);
      const itemsList = menuSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setMenuItems(itemsList);
    };
    fetchMenu();
  }, [ownerId]);

  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handleSuccessfulPayment = async (response) => {
    if (!auth.currentUser) {
      alert("Error: You must be logged in to place an order.");
      return;
    }
    const orderDetails = {
      items: cart,
      totalAmount: total,
      status: "Paid - New Order",
      timestamp: serverTimestamp(),
      ownerId: ownerId, // Save the correct owner's ID
      screen: screen,
      seat: seat,
      paymentId: response.razorpay_payment_id,
      orderId: response.razorpay_order_id,
      customerId: auth.currentUser.uid,
      customerEmail: auth.currentUser.email,
    };
    try {
      await addDoc(collection(db, 'Orders'), orderDetails);
      const userDocRef = doc(db, "users", auth.currentUser.uid);
      await updateDoc(userDocRef, {
        stampCount: increment(1)
      });
      alert(`Payment successful! Order has been placed.`);
      setCart([]);
    } catch (error) {
      console.error("Error saving order:", error);
      alert("Payment successful, but failed to save order details.");
    }
  };

  const initiatePayment = async () => {
    if (total === 0) return;
    if (!auth.currentUser) {
      alert("Please log in to place an order.");
      return;
    }

    const isScriptLoaded = await loadRazorpayScript();
    if (!isScriptLoaded) {
      alert('Razorpay SDK failed to load. Are you online?');
      return;
    }

    try {
      const response = await fetch(FUNCTION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: total * 100 }),
      });
      const order = await response.json();
      if (!response.ok) throw new Error('Failed to create Razorpay order.');

      const options = {
        key: RAZORPAY_KEY_ID,
        amount: order.amount,
        currency: "INR",
        name: "Interval",
        description: "Food & Beverage Order",
        order_id: order.id,
        handler: handleSuccessfulPayment,
        prefill: {
          name: auth.currentUser.displayName,
          email: auth.currentUser.email,
        },
        notes: {
          address: `Screen: ${screen}, Seat: ${seat}`,
        },
        theme: {
          color: "#facc15",
        },
      };
      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (error) {
      console.error("Error initiating payment:", error);
      alert(`Error: ${error.message}`);
    }
  };
  
  useEffect(() => {
    const newTotal = cart.reduce((sum, item) => sum + item.Price * item.quantity, 0);
    setTotal(newTotal);
  }, [cart]);

  const addToCart = (itemToAdd) => {
    setCart(prevCart => {
      const isItemInCart = prevCart.find(item => item.id === itemToAdd.id);
      if (isItemInCart) {
        return prevCart.map(item =>
          item.id === itemToAdd.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      } else {
        return [...prevCart, { ...itemToAdd, quantity: 1 }];
      }
    });
  };

  return (
    <div className="page-container">
      <header className="App-header" style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <h2>Menu for Screen: {screen}, Seat: {seat}</h2>
      </header>
      <div className="main-container">
        <div className="menu-container">
          <h3>Our Menu</h3>
          {menuItems.map(item => (
            <div key={item.id} className="menu-item-card">
              <div className="item-details">
                <h4>{item.ItemName}</h4>
                <p>₹{item.Price}</p>
                <p>{item.Description}</p>
              </div>
              <button onClick={() => addToCart(item)} className="auth-button" style={{ width: 'auto' }}>Add to Cart</button>
            </div>
          ))}
        </div>
        <div className="cart-container">
          <h3>Your Cart</h3>
          {cart.length === 0 ? (
            <p>Your cart is empty.</p>
          ) : (
            cart.map(item => (
              <div key={item.id} className="cart-item">
                <span>{item.ItemName}</span>
                <span>x {item.quantity}</span>
                <span>₹{item.Price * item.quantity}</span>
              </div>
            ))
          )}
          <hr />
          <div className="cart-total">
            <h4>Total: ₹{total}</h4>
            <button
              className="place-order-btn"
              onClick={initiatePayment}
              disabled={cart.length === 0}
              style={{ width: '100%', padding: '1rem', fontWeight: 'bold', fontSize: '1.1rem' }}
            >
              Proceed to Pay
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Home;
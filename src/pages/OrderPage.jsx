import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { db } from '../firebaseConfig';
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import './OrderPage.css';

function OrderPage() {
  const { ownerId, screen, seat } = useParams();
  const [dialogue, setDialogue] = useState('Welcome! What would you like to order?');
  const [isLoading, setIsLoading] = useState(true);
  const [menuItems, setMenuItems] = useState([]);
  const [cart, setCart] = useState([]);
  const [error, setError] = useState('');

  // Effect for fetching the localized dialogue
  useEffect(() => {
    const fetchDialogue = (lat, lon) => {
      const functionUrl = `https://asia-south1-theatre-pantry.cloudfunctions.net/getDialogueForLocation?lat=${lat}&lon=${lon}`;
      fetch(functionUrl)
        .then(response => response.json())
        .then(data => {
          if (data.dialogue) setDialogue(data.dialogue);
        })
        .catch(err => console.error("Could not fetch dialogue:", err));
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => fetchDialogue(position.coords.latitude, position.coords.longitude),
        (err) => setError('Could not get your location.')
      );
    } else {
      setError("Geolocation is not supported.");
    }
  }, []);

  // Effect for fetching the menu items
  useEffect(() => {
    const fetchMenu = async () => {
      if (!ownerId) return;
      try {
        const menuQuery = query(collection(db, "Menu"), where("ownerId", "==", ownerId));
        const querySnapshot = await getDocs(menuQuery);
        const items = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setMenuItems(items);
      } catch (err) {
        console.error("Error fetching menu:", err);
        setError("Could not load the menu at this time.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchMenu();
  }, [ownerId]);

  const addToCart = (item) => {
    setCart(prevCart => {
      const existingItem = prevCart.find(cartItem => cartItem.id === item.id);
      if (existingItem) {
        return prevCart.map(cartItem =>
          cartItem.id === item.id ? { ...cartItem, quantity: cartItem.quantity + 1 } : cartItem
        );
      }
      return [...prevCart, { ...item, quantity: 1 }];
    });
  };

  const calculateTotal = () => {
    return cart.reduce((total, item) => total + item.Price * item.quantity, 0);
  };

  // --- NEW PAYMENT HANDLING FUNCTION ---
  const handlePayment = async () => {
    const totalAmount = calculateTotal();
    if (totalAmount <= 0) {
      alert("Your cart is empty!");
      return;
    }

    try {
      // 1. Create the order on your backend
      const response = await fetch('https://asia-south1-theatre-pantry.cloudfunctions.net/createRazorpayOrder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
              amount: totalAmount * 100, // Amount in paise
              venueId: ownerId 
          })
      });
      const order = await response.json();

      if (!response.ok) {
          throw new Error('Failed to create order.');
      }

      // 2. Open Razorpay Checkout
      const options = {
          key: "rzp_test_Sau6n14kXnINu7", // Your Test Key ID
          amount: order.amount,
          currency: "INR",
          name: "BuzzOrders",
          description: "In-Venue Order Payment",
          order_id: order.id,
          handler: async function (response) {
              // 3. On successful payment, save the order to Firestore
              await addDoc(collection(db, "Orders"), {
                  ownerId: ownerId,
                  location: { screen: screen, seat: seat },
                  items: cart,
                  totalAmount: totalAmount,
                  status: "Paid - Pending Assignment",
                  createdAt: serverTimestamp(),
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_order_id: response.razorpay_order_id,
              });
              alert("Payment Successful! Your order has been placed.");
              setCart([]); // Clear the cart
          },
          prefill: {
              name: "Customer Name",
              email: "customer@example.com",
              contact: "9999999999"
          },
          theme: {
              color: "#111827"
          }
      };
      const rzp1 = new window.Razorpay(options);
      rzp1.open();

    } catch (error) {
        console.error("Payment failed:", error);
        alert("Payment failed. Please try again.");
    }
  };

  return (
    <div className="order-page-container">
      <header className="order-page-header">
        <h1>BuzzOrders</h1>
      </header>
      
      <div className="dialogue-box">
        <h2 className="dialogue-text">{dialogue}</h2>
        {error && <p className="error-subtext">{error}</p>}
      </div>
      
      <p className="location-info">
        Ordering for: <strong>{screen !== 'none' ? `Screen ${screen}, ` : ''}Seat/Table {seat}</strong>
      </p>
      
      <div className="menu-and-cart-container">
        <div className="menu-list">
          <h3>Menu</h3>
          {isLoading ? (
            <p>Loading menu...</p>
          ) : (
            menuItems.map(item => (
              <div key={item.id} className="menu-item">
                <div className="item-details">
                  <span className="item-name">{item.ItemName}</span>
                  <span className="item-price">₹{item.Price}</span>
                </div>
                <button className="add-to-cart-btn" onClick={() => addToCart(item)}>Add</button>
              </div>
            ))
          )}
        </div>

        {cart.length > 0 && (
          <div className="cart-summary">
            <h3>Your Order</h3>
            {cart.map(item => (
              <div key={item.id} className="cart-item">
                <span>{item.ItemName} (x{item.quantity})</span>
                <span>₹{(item.Price * item.quantity).toFixed(2)}</span>
              </div>
            ))}
            <hr />
            <div className="cart-total">
              <strong>Total</strong>
              <strong>₹{calculateTotal().toFixed(2)}</strong>
            </div>
            <button className="place-order-btn" onClick={handlePayment}>
              Proceed to Pay
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default OrderPage;
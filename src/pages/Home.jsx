import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { db, auth } from '../firebaseConfig';
import { collection, getDocs, doc, getDoc, query, where, addDoc, serverTimestamp, updateDoc, increment } from 'firebase/firestore';

// Haversine formula to calculate distance between two GPS points in meters
function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // metres
    const φ1 = lat1 * Math.PI/180; const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180; const Δλ = (lon2-lon1) * Math.PI/180;
    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}


const RAZORPAY_KEY_ID = "rzp_test_Sau6n14kXnINu7"; 
const FUNCTION_URL = "https://us-central1-theatre-pantry.cloudfunctions.net/createRazorpayOrder";

function Home() {
  const { ownerId, screen, seat } = useParams();
  const [menuItems, setMenuItems] = useState([]);
  const [venueLocation, setVenueLocation] = useState(null);
  const [cart, setCart] = useState([]);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    const fetchMenuAndVenue = async () => {
      if (!ownerId) return;
      // Fetch Venue location from owner's user profile
      const userDocRef = doc(db, "users", ownerId);
      const docSnap = await getDoc(userDocRef);
      if (docSnap.exists()) {
        setVenueLocation(docSnap.data().location);
      }
      // Fetch Menu for that owner
      const q = query(collection(db, "Menu"), where("ownerId", "==", ownerId));
      const menuSnapshot = await getDocs(q);
      setMenuItems(menuSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    };
    fetchMenuAndVenue();
  }, [ownerId]);

  const initiatePayment = async () => {
    if (total === 0 || !auth.currentUser) {
      alert("Please log in to place an order.");
      return;
    }
    if (!venueLocation) {
        alert("This venue has not set its GPS location yet. Ordering is currently disabled.");
        return;
    }

    // --- GEO-FENCING CHECK ---
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const userLat = position.coords.latitude;
        const userLng = position.coords.longitude;
        const distance = getDistance(venueLocation.lat, venueLocation.lng, userLat, userLng);

        // Check if user is within a certain radius (e.g., 200 meters)
        const radius = userProfile?.radius || 200; // Get radius from profile or default
        if (distance > radius) {
          alert("Error: You must be at the venue to place an order.");
          return;
        }

        // If check passes, proceed with Razorpay payment
        // ... (The entire Razorpay logic from before goes here)
      },
      (error) => {
        console.error("Geolocation error:", error);
        alert("Could not get your location. Please enable location services in your browser.");
      }
    );
  };
  
  // ... (All other functions and JSX are the same as the last working version)
}

export default Home;
import React, { useState, useEffect, useCallback } from 'react';
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';
import { getAuth, onAuthStateChanged } from "firebase/auth";

const FeeSettings = () => {
  const [currentUser, setCurrentUser] = useState(null); 
  const [venueId, setVenueId] = useState(null);
  const [feePayer, setFeePayer] = useState('');
  const [initialFeePayer, setInitialFeePayer] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUser(user);
      } else {
        setIsLoading(false);
        setMessage({ type: 'error', text: 'You must be logged in to view settings.' });
      }
    });
    return () => unsubscribe();
  }, []);

  const fetchVenueData = useCallback(async () => {
    if (!currentUser) return; 

    setIsLoading(true);
    try {
      const db = getFirestore();
      const locationsRef = collection(db, 'Locations'); 
      const q = query(locationsRef, where('ownerId', '==', currentUser.uid));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const venueDoc = querySnapshot.docs[0];
        setVenueId(venueDoc.id);
        const venueData = venueDoc.data();
        const currentFeePayer = venueData.feeConfiguration?.feePayer || 'owner';
        setFeePayer(currentFeePayer);
        setInitialFeePayer(currentFeePayer);
      } else {
        setMessage({ type: 'error', text: 'No venue found for your account.' });
      }
    } catch (error) {
      console.error("Error fetching venue data: ", error);
      setMessage({ type: 'error', text: 'Failed to load settings.' });
    } finally {
      setIsLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    if (currentUser) {
      fetchVenueData();
    }
  }, [currentUser, fetchVenueData]);

  // UPDATED handleSave function to fix CORS
  const handleSave = async () => {
    if (!venueId || !currentUser) {
      setMessage({ type: 'error', text: 'Cannot save. Venue or user not found.' });
      return;
    }
    
    setIsSaving(true);
    setMessage({ type: 'info', text: 'Saving...' });

    try {
      // 1. Get the Firebase Auth token from the current user
      const token = await currentUser.getIdToken();

      // IMPORTANT: Replace 'theatre-pantry' with your actual Firebase Project ID if it's different.
      const functionUrl = 'https://asia-south1-theatre-pantry.cloudfunctions.net/updateFeeConfiguration';

      // 2. Call the new HTTP function using fetch
      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` // Send the token for verification
        },
        body: JSON.stringify({ 
          venueId: venueId, 
          feePayer: feePayer 
        })
      });

      if (!response.ok) {
        // If the server response is not 200 OK, throw an error
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to save settings.');
      }
      
      const result = await response.json();
      setMessage({ type: 'success', text: result.message || 'Settings saved successfully!' });
      setInitialFeePayer(feePayer);

    } catch (error) {
      console.error("Error saving settings: ", error);
      setMessage({ type: 'error', text: error.message });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div>Loading Fee Settings...</div>;
  }
  
  if (!currentUser || (message.text && message.type === 'error' && !venueId)) {
     return <div style={{ color: 'red', padding: '20px' }}>{message.text}</div>;
  }
  
  const styles = {
    container: { padding: '20px', border: '1px solid #ccc', borderRadius: '8px', maxWidth: '500px', margin: '20px 0' },
    title: { margin: '0 0 15px 0' },
    option: { margin: '10px 0', display: 'flex', alignItems: 'center' },
    input: { marginRight: '10px' },
    button: { padding: '10px 20px', cursor: 'pointer', marginTop: '15px', border: 'none', borderRadius: '5px', backgroundColor: '#111827', color: 'white' },
    message: {
        marginTop: '15px',
        padding: '10px',
        borderRadius: '5px',
        color: 'white',
        backgroundColor: message.type === 'success' ? '#4CAF50' : (message.type === 'error' ? '#f44336' : '#2196F3')
    }
  };

  return (
    <div style={styles.container}>
      <h3 style={styles.title}>Payment Fee Settings</h3>
      <p>Choose who will pay the payment processing & platform fees.</p>
      
      <div style={styles.option}>
        <input
          type="radio"
          id="ownerPays"
          name="feePayer"
          value="owner"
          checked={feePayer === 'owner'}
          onChange={(e) => setFeePayer(e.target.value)}
          style={styles.input}
        />
        <label htmlFor="ownerPays">
          <strong>I will pay the fee</strong> (Standard Method)
          <br />
          <small>The fee will be deducted from your payout. This provides the best customer experience.</small>
        </label>
      </div>

      <div style={styles.option}>
        <input
          type="radio"
          id="customerPays"
          name="feePayer"
          value="customer"
          checked={feePayer === 'customer'}
          onChange={(e) => setFeePayer(e.target.value)}
          style={styles.input}
        />
        <label htmlFor="customerPays">
          <strong>The customer will pay the fee</strong> (Convenience Fee)
          <br />
          <small>The fee will be added to the customer's total bill at checkout.</small>
        </label>
      </div>

      <button 
        onClick={handleSave} 
        disabled={isSaving || feePayer === initialFeePayer}
        style={{...styles.button, opacity: (isSaving || feePayer === initialFeePayer) ? 0.6 : 1}}
      >
        {isSaving ? 'Saving...' : 'Save Changes'}
      </button>

      {message.text && (
        <div style={styles.message}>
          {message.text}
        </div>
      )}
    </div>
  );
};

export default FeeSettings;
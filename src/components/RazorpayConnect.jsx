import React, { useState, useEffect, useCallback } from 'react';
import { getFirestore, collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getAuth } from "firebase/auth";
import { getApp } from "firebase/app";

const RazorpayConnect = () => {
  const [razorpayStatus, setRazorpayStatus] = useState('loading');
  const [accountId, setAccountId] = useState(null);
  const [venueId, setVenueId] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const auth = getAuth();

  const app = getApp();
  const functions = getFunctions(app, 'asia-south1');


  useEffect(() => {
    if (!auth.currentUser) return;

    const db = getFirestore();
    const locationsRef = collection(db, 'Locations');
    const q = query(locationsRef, where('ownerId', '==', auth.currentUser.uid));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      if (!querySnapshot.empty) {
        const venueDoc = querySnapshot.docs[0];
        setVenueId(venueDoc.id);
        const razorpayData = venueDoc.data().razorpay;
        setRazorpayStatus(razorpayData?.status || 'not_connected');
        setAccountId(razorpayData?.accountId || null);
      } else {
        setRazorpayStatus('no_venue');
      }
    }, (error) => {
      console.error("Error fetching venue data:", error);
      setRazorpayStatus('error');
    });

    return () => unsubscribe();
  }, [auth.currentUser]);

  const handleConnect = async () => {
    if (!venueId) {
      setMessage({ type: 'error', text: 'Venue not found. Cannot connect.' });
      return;
    }
    setIsConnecting(true);
    setMessage({ type: '', text: '' });

    try {
      // --- THIS IS THE FIX ---
      // Changed the function name to the new one: 'setupRazorpayVendor'
      const setupRazorpayVendor = httpsCallable(functions, 'setupRazorpayVendor');
      const result = await setupRazorpayVendor({ venueId: venueId });
      // --- END OF FIX ---
      
      if (result.data.success && result.data.accountId) {
        const onboardingUrl = `https://dashboard.razorpay.com/authorize/${result.data.accountId}`;
        window.location.href = onboardingUrl;
      } else {
        throw new Error('Failed to get account details from server.');
      }
    } catch (error) {
      console.error("Error connecting to Razorpay:", error);
      setMessage({ type: 'error', text: error.message || 'Could not connect to Razorpay.' });
      setIsConnecting(false);
    }
  };

  const renderStatus = () => {
    switch (razorpayStatus) {
      case 'loading':
        return <p>Loading payment status...</p>;
      case 'not_connected':
        return (
          <>
            <p>Connect your Razorpay account to receive payments directly to your bank account.</p>
            <button onClick={handleConnect} disabled={isConnecting}>
              {isConnecting ? 'Connecting...' : 'Connect with Razorpay'}
            </button>
          </>
        );
      case 'created':
        return (
          <div style={{color: '#EAB308'}}>
            <p><strong>Pending Activation:</strong> Your Razorpay account is created but requires activation. Please complete the onboarding process.</p>
            <button onClick={() => window.location.href = `https://dashboard.razorpay.com/authorize/${accountId}`}>
              Complete Onboarding
            </button>
          </div>
        );
      case 'activated':
        return (
           <div style={{color: '#22C55E'}}>
            <p><strong>Active:</strong> Your Razorpay account is connected and ready to receive payments.</p>
            <p><small>Account ID: {accountId}</small></p>
          </div>
        );
      case 'no_venue':
        return <p style={{color: 'red'}}>No venue is associated with your account.</p>;
      default:
        return <p style={{color: 'red'}}>An error occurred while fetching your payment status.</p>;
    }
  };

  return (
    <div style={{ padding: '20px', border: '1px solid #ccc', borderRadius: '8px', maxWidth: '500px', margin: '20px 0' }}>
      <h3>Payout Account</h3>
      {renderStatus()}
      {message.text && <p style={{color: message.type === 'error' ? 'red' : 'blue'}}>{message.text}</p>}
    </div>
  );
};

export default RazorpayConnect;
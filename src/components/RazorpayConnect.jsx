// RazorpayConnect.jsx

import React, { useState, useEffect } from 'react';
import { getFirestore, collection, query, where, onSnapshot } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getAuth } from "firebase/auth";
import { getApp } from "firebase/app";
import RazorpayOnboardingForm from './RazorpayOnboardingForm'; // కొత్త ఫారంను ఇక్కడ ఇంపోర్ట్ చేయండి

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

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const venueDoc = snapshot.docs[0];
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
      const createRazorpayLinkedAccount = httpsCallable(functions, 'createRazorpayLinkedAccount');
      const result = await createRazorpayLinkedAccount({ venueId: venueId });
      
      if (result.data.success) {
        setMessage({ type: 'success', text: 'Account created! Please complete the next step.' });
      } else {
        throw new Error(result.data.message || 'Failed to create linked account.');
      }
    } catch (error) {
      console.error("Error connecting to Razorpay:", error);
      setMessage({ type: 'error', text: error.message || 'Could not connect to Razorpay.' });
    } finally {
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
            <p>Connect your Razorpay account to receive payments directly.</p>
            <button onClick={handleConnect} disabled={isConnecting}>
              {isConnecting ? 'Connecting...' : 'Connect with Razorpay'}
            </button>
          </>
        );
      case 'created':
        // అకౌంట్ క్రియేట్ అయిన తర్వాత, KYC ఫారం చూపించండి
        return <RazorpayOnboardingForm accountId={accountId} venueId={venueId} />;
      case 'activated':
        return (
           <div style={{color: '#22C55E'}}>
            <p><strong>✓ Active:</strong> Your Razorpay account is connected and ready to receive payments.</p>
            <p><small>Account ID: {accountId}</small></p>
           </div>
        );
      case 'no_venue':
        return <p style={{color: 'red'}}>No venue is associated with your account.</p>;
      default:
        return <p style={{color: 'red'}}>An error occurred.</p>;
    }
  };

  return (
    <div style={{ padding: '20px', border: '1px solid #eee', borderRadius: '8px', maxWidth: '600px', margin: '20px auto', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
      <h3 style={{borderBottom: '1px solid #eee', paddingBottom: '10px'}}>Payout Account</h3>
      {renderStatus()}
      {message.text && !['created', 'activated'].includes(razorpayStatus) && 
        <p style={{color: message.type === 'error' ? 'red' : 'green', marginTop: '15px'}}>{message.text}</p>
      }
    </div>
  );
};

export default RazorpayConnect;
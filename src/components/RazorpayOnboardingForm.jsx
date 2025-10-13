// src/components/RazorpayOnboardingForm.jsx

import React, { useState } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getApp } from "firebase/app";

const RazorpayOnboardingForm = ({ accountId, venueId }) => {
  const [formData, setFormData] = useState({
    // Stakeholder fields
    stakeholderName: '',
    stakeholderEmail: '',
    stakeholderPan: '',
    // Bank account fields
    bankAccountName: '',
    bankAccountNumber: '',
    bankIfsc: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  
  const app = getApp();
  const functions = getFunctions(app, 'asia-south1');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage({ type: '', text: '' });

    try {
      // Step 1: Create Stakeholder
      const createStakeholder = httpsCallable(functions, 'createStakeholder');
      await createStakeholder({
        accountId: accountId,
        name: formData.stakeholderName,
        email: formData.stakeholderEmail,
        pan: formData.stakeholderPan,
      });

      // Step 2: Request Product Configuration
      const requestProductConfig = httpsCallable(functions, 'requestProductConfiguration');
      await requestProductConfig({ accountId: accountId });

      // Step 3: Update Product Configuration with Bank Details
      const updateProductConfig = httpsCallable(functions, 'updateProductConfiguration');
      const finalResult = await updateProductConfig({
        accountId: accountId,
        bankAccountName: formData.bankAccountName,
        bankAccountNumber: formData.bankAccountNumber,
        bankIfsc: formData.bankIfsc,
      });

      if (finalResult.data.success) {
        setMessage({ type: 'success', text: 'Onboarding details submitted successfully! Your account will be activated after verification.' });
        // The onSnapshot listener in RazorpayConnect will automatically update the status to 'activated'
      } else {
        throw new Error('Failed to update bank details.');
      }

    } catch (error) {
      console.error("Error submitting onboarding data:", error);
      setMessage({ type: 'error', text: error.message || 'An error occurred during submission.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const styles = {
    form: { display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '20px' },
    input: { padding: '10px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '1em' },
    button: { padding: '10px 15px', border: 'none', borderRadius: '4px', backgroundColor: '#007bff', color: 'white', fontSize: '1em', cursor: 'pointer' },
    h4: { margin: '15px 0 5px 0', borderBottom: '1px solid #eee', paddingBottom: '5px' },
    message: { marginTop: '15px', padding: '10px', borderRadius: '4px' },
    error: { color: 'red', backgroundColor: '#ffebee' },
    success: { color: 'green', backgroundColor: '#e8f5e9' }
  };

  return (
    <div>
      <p><strong>Action Required:</strong> To activate your account, please provide your business (KYC) and bank details below.</p>
      <form onSubmit={handleSubmit} style={styles.form}>
        <h4 style={styles.h4}>Business Owner Details (KYC)</h4>
        <input type="text" name="stakeholderName" value={formData.stakeholderName} onChange={handleChange} placeholder="Full Name (as on PAN card)" required style={styles.input} />
        <input type="email" name="stakeholderEmail" value={formData.stakeholderEmail} onChange={handleChange} placeholder="Contact Email" required style={styles.input} />
        <input type="text" name="stakeholderPan" value={formData.stakeholderPan} onChange={handleChange} placeholder="PAN Card Number" required style={styles.input} />
        
        <h4 style={styles.h4}>Bank Account Details (for Payouts)</h4>
        <input type="text" name="bankAccountName" value={formData.bankAccountName} onChange={handleChange} placeholder="Account Holder Name" required style={styles.input} />
        <input type="text" name="bankAccountNumber" value={formData.bankAccountNumber} onChange={handleChange} placeholder="Bank Account Number" required style={styles.input} />
        <input type="text" name="bankIfsc" value={formData.bankIfsc} onChange={handleChange} placeholder="IFSC Code" required style={styles.input} />

        <button type="submit" disabled={isSubmitting} style={styles.button}>
          {isSubmitting ? 'Submitting...' : 'Submit & Activate Account'}
        </button>
      </form>
      {message.text && (
        <p style={{ ...styles.message, ...(message.type === 'error' ? styles.error : styles.success) }}>
          {message.text}
        </p>
      )}
    </div>
  );
};

export default RazorpayOnboardingForm;
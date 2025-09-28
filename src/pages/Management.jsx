import React, { useState, useRef, useEffect } from 'react';
import Dashboard from './Dashboard';
import Venue from './Venue';
import StaffManagement from './StaffManagement';
import PantryView from './PantryView';
import FeeSettings from '../components/FeeSettings';
import RazorpayConnect from '../components/RazorpayConnect'; // <-- 1. IMPORT the new component
import './Management.css';

function Management() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const contentRef = useRef(null);

  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = 0;
    }
  }, [activeTab]);

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'venue':
        return <Venue />;
      case 'staff':
        return <StaffManagement />;
      case 'pantry':
        return <PantryView />;
      case 'settings':
        return ( // <-- 2. WRAP settings components in a fragment
          <>
            <RazorpayConnect />
            <FeeSettings />
          </>
        );
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="management-page-wrapper">
      <header className="management-header">
        <h1>Management</h1>
        <nav className="management-tabs">
          <button onClick={() => setActiveTab('dashboard')} className={activeTab === 'dashboard' ? 'active' : ''}>Dashboard</button>
          <button onClick={() => setActiveTab('venue')} className={activeTab === 'venue' ? 'active' : ''}>Venue Setup</button>
          <button onClick={() => setActiveTab('staff')} className={activeTab === 'staff' ? 'active' : ''}>Staff</button>
          <button onClick={() => setActiveTab('pantry')} className={activeTab === 'pantry' ? 'active' : ''}>Pantry</button>
          <button onClick={() => setActiveTab('settings')} className={activeTab === 'settings' ? 'active' : ''}>Settings</button>
        </nav>
      </header>
      <main className="management-content" ref={contentRef}>
        {renderContent()}
      </main>
    </div>
  );
}

export default Management;
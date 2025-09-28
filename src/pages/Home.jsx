import { useState, useEffect, useMemo } from 'react';
import { db, auth } from '../firebaseConfig';
import { doc, getDoc, updateDoc, collection, addDoc, query, where, getDocs, writeBatch, deleteDoc } from 'firebase/firestore';
import { MapContainer, TileLayer, Marker, Circle, useMapEvents } from 'react-leaflet';
import { QRCodeCanvas } from 'qrcode.react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import './Venue.css';

// --- Reusable Map Picker Component ---
function LocationPicker({ savedPosition, radius, onPositionChange }) {
  const [position, setPosition] = useState(savedPosition);
  useEffect(() => { setPosition(savedPosition); }, [savedPosition]);

  const MapEvents = () => {
    const map = useMapEvents({
      click(e) {
        const newPos = [e.latlng.lat, e.latlng.lng];
        setPosition(newPos);
        onPositionChange(e.latlng);
      },
    });
    useEffect(() => { map.flyTo(position, map.getZoom()); }, [position, map]);
    return null;
  };

  return (
    <div className="map-container">
      <h4>Set Business GPS Location</h4>
      <p>Click on the map to set your location, then set your delivery radius below.</p>
      <MapContainer center={position} zoom={15} style={{ height: '300px', width: '100%', borderRadius: '8px' }}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <Marker position={position}></Marker>
        <Circle center={position} radius={radius} pathOptions={{ color: '#3b82f6', fillColor: '#3b82f6' }} />
        <MapEvents />
      </MapContainer>
    </div>
  );
}

// --- Main Venue Component ---
const naturalSort = (a, b) => {
  const re = /(\d+)/g;
  const aParts = String(a).split(re);
  const bParts = String(b).split(re);
  for (let i = 0; i < Math.min(aParts.length, bParts.length); i++) {
    const aPart = aParts[i];
    const bPart = bParts[i];
    if (i % 2) {
      const aNum = parseInt(aPart, 10);
      const bNum = parseInt(bPart, 10);
      if (aNum !== bNum) return aNum - bNum;
    } else {
      if (aPart !== bPart) return aPart.localeCompare(bPart);
    }
  }
  return a.length - b.length;
};

function Venue() {
  const [userProfile, setUserProfile] = useState(null);
  const [allLocations, setAllLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentLocationId, setCurrentLocationId] = useState(null);
  const [gpsLocation, setGpsLocation] = useState([17.3850, 78.4867]);
  const [radius, setRadius] = useState(200);
  const [screen, setScreen] = useState('1');
  const [row, setRow] = useState('A');
  const [seat, setSeat] = useState('');
  const [seatFrom, setSeatFrom] = useState(1);
  const [seatTo, setSeatTo] = useState(10);
  const [table, setTable] = useState('');
  const [qrCodeData, setQrCodeData] = useState(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const fetchVenueData = async () => {
    if (auth.currentUser) {
      const userDocRef = doc(db, "users", auth.currentUser.uid);
      const docSnap = await getDoc(userDocRef);
      if (docSnap.exists()) {
        const profile = docSnap.data();
        setUserProfile(profile);
        if (profile.location) setGpsLocation([profile.location.lat, profile.location.lng]);
        if (profile.radius) setRadius(profile.radius);
      }
      
      const locationsQuery = query(collection(db, "Locations"), where("ownerId", "==", auth.currentUser.uid));
      const querySnapshot = await getDocs(locationsQuery);
      let locs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      locs.sort((a, b) => {
        if (a.screen && b.screen && a.screen !== b.screen) return naturalSort(a.screen, b.screen);
        if (a.seat && b.seat) return naturalSort(a.seat, b.seat);
        if (a.table && b.table) return naturalSort(a.table, b.table);
        return 0;
      });
      setAllLocations(locs);
    }
    setLoading(false);
  };

  useEffect(() => { fetchVenueData(); }, []);

  const handleLocationSave = async (newLocation) => {
    const userDocRef = doc(db, "users", auth.currentUser.uid);
    await updateDoc(userDocRef, { location: { lat: newLocation.lat, lng: newLocation.lng } });
    alert("GPS Location saved!");
    setGpsLocation([newLocation.lat, newLocation.lng]);
  };

  const handleRadiusSave = async () => {
    const userDocRef = doc(db, "users", auth.currentUser.uid);
    await updateDoc(userDocRef, { radius: Number(radius) });
    alert(`Delivery radius updated to ${radius} meters!`);
  };

  const handleBusinessTypeUpdate = async (type) => {
    const userDocRef = doc(db, "users", auth.currentUser.uid);
    await updateDoc(userDocRef, { businessType: type });
    fetchVenueData();
  };

  const openAddModal = () => {
    setIsEditing(false); setCurrentLocationId(null);
    setScreen('1'); setRow('A'); setSeatFrom(1); setSeatTo(10); setTable(''); setSeat('');
    setIsModalOpen(true);
  };

  const openEditModal = (loc) => {
    setIsEditing(true); setCurrentLocationId(loc.id);
    if (loc.screen) { setScreen(loc.screen); setSeat(loc.seat); }
    if (loc.table) setTable(loc.table);
    setIsModalOpen(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (isEditing) {
      const locDocRef = doc(db, "Locations", currentLocationId);
      const updatedData = userProfile.businessType === 'theatre' ? { screen, seat } : { table };
      await updateDoc(locDocRef, updatedData);
      alert("Location updated successfully!");
    } else {
      if (userProfile.businessType === 'theatre') {
        const batch = writeBatch(db);
        for (let i = seatFrom; i <= seatTo; i++) {
          const seatId = `${row.toUpperCase()}${i}`;
          const newLocationData = { ownerId: auth.currentUser.uid, screen, seat: seatId };
          const newDocRef = doc(collection(db, "Locations"));
          batch.set(newDocRef, newLocationData);
        }
        await batch.commit();
        alert(`Successfully added seats ${row.toUpperCase()}${seatFrom} to ${row.toUpperCase()}${seatTo}!`);
      } else {
        const newLocationData = { ownerId: auth.currentUser.uid, table };
        await addDoc(collection(db, "Locations"), newLocationData);
        alert(`Successfully added Table ${table}!`);
      }
    }
    setIsModalOpen(false);
    fetchVenueData();
  };
  
  const handleDeleteLocation = async (locId) => {
    if (window.confirm("Are you sure you want to delete this location?")) {
        await deleteDoc(doc(db, "Locations", locId));
        alert("Location deleted successfully.");
        fetchVenueData();
    }
  };

  const handleGenerateQr = (location) => {
    const ownerId = auth.currentUser.uid;
    const locationName = location.screen ? `Screen ${location.screen}, Seat ${location.seat}` : `Table ${location.table}`;
    const url = `${window.location.origin}/order/${ownerId}/${location.screen || 'none'}/${location.seat || location.table}`;
    setQrCodeData({ url, label: locationName });
  };

  const handleDownloadQr = () => {
    const canvas = document.getElementById('qr-code-canvas');
    const pngUrl = canvas.toDataURL('image/png').replace('image/png', 'image/octet-stream');
    let downloadLink = document.createElement('a');
    downloadLink.href = pngUrl;
    downloadLink.download = `${qrCodeData.label}-qrcode.png`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  };

  const handleDownloadAllPdfs = async () => {
    setIsGeneratingPdf(true);
    setTimeout(async () => {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const qrItems = document.querySelectorAll('.qr-pdf-item');
      
      for (let i = 0; i < qrItems.length; i++) {
        const qrItem = qrItems[i];
        const canvas = await html2canvas(qrItem);
        const imgData = canvas.toDataURL('image/png');
        
        if (i > 0) pdf.addPage();
        pdf.addImage(imgData, 'PNG', 10, 10, 190, 0);
      }
      
      pdf.save('All-Venue-QR-Codes.pdf');
      setIsGeneratingPdf(false);
    }, 100);
  };
  
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const filteredLocations = useMemo(() => {
    return allLocations.filter(loc => {
      const searchContent = `${loc.screen || ''} ${loc.seat || ''} ${loc.table || ''}`;
      return searchContent.toLowerCase().includes(searchTerm.toLowerCase());
    });
  }, [allLocations, searchTerm]);

  const paginatedLocations = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredLocations.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredLocations, currentPage]);
  
  const totalPages = Math.ceil(filteredLocations.length / itemsPerPage);

  if (loading) return <div className="page-container"><h2>Loading...</h2></div>;

  return (
    <>
      {isModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <div className="modal-header">
              <h3>{isEditing ? 'Edit Location' : 'Add New Location(s)'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="close-btn">&times;</button>
            </div>
            <form onSubmit={handleFormSubmit}>
              {userProfile?.businessType === 'theatre' && (
                <>
                  <div className="form-group"><label>Screen Number</label><input type="text" value={screen} onChange={e => setScreen(e.target.value)} required /></div>
                  {isEditing ? (
                     <div className="form-group"><label>Seat</label><input type="text" value={seat} onChange={e => setSeat(e.target.value)} required /></div>
                  ) : (
                    <>
                      <div className="form-group"><label>Row Letter</label><input type="text" value={row} onChange={e => setRow(e.target.value.toUpperCase())} required /></div>
                      <div className="bulk-add-inputs">
                        <div className="form-group"><label>From Seat</label><input type="number" min="1" value={seatFrom} onChange={e => setSeatFrom(Number(e.target.value))} required /></div>
                        <div className="form-group"><label>To Seat</label><input type="number" min="1" value={seatTo} onChange={e => setSeatTo(Number(e.target.value))} required /></div>
                      </div>
                    </>
                  )}
                </>
              )}
              {(userProfile?.businessType === 'cafe' || userProfile?.businessType === 'restaurant') && (
                <div className="form-group"><label>Table Number</label><input type="text" value={table} onChange={(e) => setTable(e.target.value)} required /></div>
              )}
              <button type="submit" className="auth-button">{isEditing ? 'Update Location' : 'Save Location(s)'}</button>
            </form>
          </div>
        </div>
      )}

      {qrCodeData && (
        <div className="modal-backdrop" onClick={() => setQrCodeData(null)}>
          <div className="modal-content qr-modal" onClick={e => e.stopPropagation()}>
            <h3>{qrCodeData.label}</h3>
            <QRCodeCanvas 
              id="qr-code-canvas" 
              value={qrCodeData.url} 
              size={256} 
              level={"H"} // Use High error correction for reliability with a logo
              includeMargin={true}
              imageSettings={{
                src: "/logo.png",
                height: 48,
                width: 48,
                excavate: true,
              }}
            />
            <div>
              <button onClick={handleDownloadQr} className="action-button">Download</button>
              <button onClick={() => setQrCodeData(null)} className="secondary-button">Close</button>
            </div>
          </div>
        </div>
      )}

      <div className="page-container">
        <h1>My Venue Setup</h1>
        
        {!userProfile?.businessType ? (
          <div className="setup-card" style={{maxWidth: '500px'}}>
            <h3>Step 1: Select Your Business Type</h3>
            <p>This will customize your dashboard and ordering experience.</p>
            <div className="form-group"><select onChange={(e) => handleBusinessTypeUpdate(e.target.value)} defaultValue=""><option value="" disabled>-- Select a Type --</option><option value="theatre">Theatre</option><option value="cafe">Cafe</option><option value="restaurant">Restaurant</option></select></div>
          </div>
        ) : (
          <div>
            <div className="setup-card" style={{marginBottom: '2rem'}}>
              <h3>Geo-Fencing Setup</h3>
              <LocationPicker savedPosition={gpsLocation} radius={radius} onPositionChange={handleLocationSave} />
              <div className="radius-slider">
                <label htmlFor="radius">Delivery Radius: <span className="radius-value">{radius} meters</span></label>
                <input type="range" id="radius" min="50" max="1000" step="50" value={radius} onChange={(e) => setRadius(e.target.value)} />
                <button className="auth-button" style={{marginTop: '1rem'}} onClick={handleRadiusSave}>Save Radius</button>
              </div>
            </div>
            
            <section className="menu-management-section">
                <h2>Manage Individual Locations</h2>
                <div className="venue-setup-grid">
                    <div className="setup-card manage-locations-card">
                        <h3>Manage Locations</h3>
                        <p>Add, edit, or delete your seats and tables.</p>
                        <button className="auth-button" onClick={openAddModal}>Add New Location(s)</button>
                    </div>
                    <div className="location-list">
                        <div className="location-list-header">
                            <h3>My Saved Locations</h3>
                            <div style={{display: 'flex', alignItems: 'center'}}>
                                <button onClick={handleDownloadAllPdfs} className="download-all-btn" disabled={isGeneratingPdf || allLocations.length === 0}>
                                    {isGeneratingPdf ? 'Generating...' : 'Download All as PDF'}
                                </button>
                                <input type="text" placeholder="Search locations..." className="search-input" value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}/>
                            </div>
                        </div>
                        <table className="locations-table">
                            <thead><tr><th>{userProfile.businessType === 'theatre' ? 'Screen' : 'Table'}</th>{userProfile.businessType === 'theatre' && <th>Seat</th>}<th>Actions</th></tr></thead>
                            <tbody>
                                {paginatedLocations.map(loc => (
                                    <tr key={loc.id}>
                                        <td>{loc.screen || loc.table}</td>
                                        {userProfile.businessType === 'theatre' && <td>{loc.seat}</td>}
                                        <td>
                                          <div className="location-item-actions">
                                            <button onClick={() => openEditModal(loc)} className="edit-btn">Edit</button>
                                            <button onClick={() => handleDeleteLocation(loc.id)} className="delete-btn">Delete</button>
                                            <button onClick={() => handleGenerateQr(loc)} className="qr-code-btn">QR</button>
                                          </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <div className="pagination-controls">
                            <span>Page {currentPage} of {totalPages > 0 ? totalPages : 1}</span>
                            <button onClick={() => setCurrentPage(p => p - 1)} disabled={currentPage === 1}>Previous</button>
                            <button onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage >= totalPages}>Next</button>
                        </div>
                    </div>
                </div>
            </section>
          </div>
        )}
      </div>

      {isGeneratingPdf && (
        <div className="hidden-qr-container">
          {allLocations.map(loc => {
            const ownerId = auth.currentUser.uid;
            const locationName = loc.screen ? `Screen ${loc.screen}, Seat ${loc.seat}` : `Table ${loc.table}`;
            const url = `${window.location.origin}/order/${ownerId}/${loc.screen || 'none'}/${loc.seat || loc.table}`;
            return (
              <div key={loc.id} className="qr-pdf-item" id={`pdf-item-${loc.id}`}>
                <h3>{locationName}</h3>
                <QRCodeCanvas 
                  value={url} 
                  size={500} 
                  level={"H"} // Use High error correction here too
                  includeMargin={true} 
                  imageSettings={{ src: "/logo.png", height: 90, width: 90, excavate: true }} />
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

export default Venue;
import { useState, useEffect } from 'react';
import { db, auth } from '../firebaseConfig';
import { collection, addDoc, query, where, getDocs, serverTimestamp, doc, updateDoc, deleteDoc, orderBy } from 'firebase/firestore';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { DateRange } from 'react-date-range';
import { addDays, format } from 'date-fns';
import 'react-date-range/dist/styles.css';
import 'react-date-range/dist/theme/default.css';
import './Dashboard.css';

const forbiddenKeywords = [
  'cigarette', 'cigar', 'tobacco', 'pan', 'gutkha', 'khaini', 'smokes', 'vape', 'e-cig', 'hookah',
  'gold flake', 'kings', 'classic', 'wills navy cut', 'four square', 'red & white',
  'charminar', 'vimal', 'rajnigandha', 'pan parag', 'kamla pasand', 'baba',
  'beer', 'wine', 'vodka', 'whiskey', 'rum', 'alcohol', 'liquor', 'brandy', 'gin', 'breezer',
  'kingfisher', 'royal stag', 'officers choice', 'imperial blue', 'blenders pride', 'mcdowell', 'old monk'
];

function Dashboard() {
  // States for Menu Management
  const [menuItems, setMenuItems] = useState([]);
  const [itemName, setItemName] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [currentItemId, setCurrentItemId] = useState(null);

  // States for Analytics
  const [allOrders, setAllOrders] = useState([]);
  const [stats, setStats] = useState({ totalRevenue: 0, totalOrders: 0, avgOrderValue: 0 });
  const [chartData, setChartData] = useState([]);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [dateRange, setDateRange] = useState([
    {
      startDate: addDays(new Date(), -6),
      endDate: new Date(),
      key: 'selection'
    }
  ]);

  // Combined data fetching for menu and orders
  useEffect(() => {
    const fetchAllData = async () => {
      if (auth.currentUser) {
        // Fetch Menu
        const menuQuery = query(collection(db, "Menu"), where("ownerId", "==", auth.currentUser.uid));
        const menuSnapshot = await getDocs(menuQuery);
        setMenuItems(menuSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));

        // Fetch Orders
        const ordersQuery = query(collection(db, "Orders"), where("ownerId", "==", auth.currentUser.uid), orderBy("timestamp", "desc"));
        const ordersSnapshot = await getDocs(ordersQuery);
        setAllOrders(ordersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }
    };
    const unsubscribe = auth.onAuthStateChanged(user => { if (user) fetchAllData() });
    return () => unsubscribe();
  }, []);

  // Analytics calculation based on date range
  useEffect(() => {
    const startDate = dateRange[0].startDate;
    const endDate = dateRange[0].endDate;
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);

    const filteredOrders = allOrders.filter(order => {
      const orderDate = order.timestamp.toDate();
      return orderDate >= startDate && orderDate <= endDate;
    });

    if (filteredOrders.length > 0) {
      const totalRevenue = filteredOrders.reduce((sum, order) => sum + order.totalAmount, 0);
      setStats({
        totalRevenue: totalRevenue.toFixed(2),
        totalOrders: filteredOrders.length,
        avgOrderValue: (totalRevenue / filteredOrders.length).toFixed(2)
      });
      
      const salesByDay = filteredOrders.reduce((acc, order) => {
        const day = format(order.timestamp.toDate(), 'yyyy-MM-dd');
        acc[day] = (acc[day] || 0) + order.totalAmount;
        return acc;
      }, {});
      
      let dayArray = [];
      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        dayArray.push(format(new Date(d), 'yyyy-MM-dd'));
      }
      
      const formattedChartData = dayArray.map(day => ({
        name: format(new Date(day), 'MMM d'),
        Sales: salesByDay[day] || 0
      }));

      setChartData(formattedChartData);
    } else {
      setStats({ totalRevenue: 0, totalOrders: 0, avgOrderValue: 0 });
      setChartData([]);
    }
  }, [dateRange, allOrders]);

  // --- MENU MANAGEMENT FUNCTIONS ---
  const fetchMyMenu = async () => {
      if (auth.currentUser) {
        const q = query(collection(db, "Menu"), where("ownerId", "==", auth.currentUser.uid));
        const querySnapshot = await getDocs(q);
        setMenuItems(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }
  };

  const clearForm = () => {
    setItemName(''); setPrice(''); setDescription(''); setIsEditing(false); setCurrentItemId(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const lowerCaseItemName = itemName.toLowerCase();
    const foundKeyword = forbiddenKeywords.find(keyword => lowerCaseItemName.includes(keyword));
    if (foundKeyword) {
      alert(`Error: Products like '${foundKeyword}' cannot be listed.`);
      return;
    }
    if (isEditing) {
      const itemDocRef = doc(db, 'Menu', currentItemId);
      await updateDoc(itemDocRef, { ItemName: itemName, Price: Number(price), Description: description });
      alert("Item updated successfully!");
    } else {
      await addDoc(collection(db, "Menu"), {
        ItemName: itemName, Price: Number(price), Description: description,
        ownerId: auth.currentUser.uid, createdAt: serverTimestamp()
      });
      alert("Item added successfully!");
    }
    clearForm();
    fetchMyMenu();
  };

  const handleEditClick = (item) => {
    setIsEditing(true); setCurrentItemId(item.id); setItemName(item.ItemName);
    setPrice(item.Price); setDescription(item.Description);
  };

  const handleDeleteClick = async (itemId) => {
    if (window.confirm("Are you sure you want to delete this item?")) {
      await deleteDoc(doc(db, 'Menu', itemId));
      alert("Item deleted successfully!");
      fetchMyMenu();
    }
  };

  return (
    <div className="page-container dashboard-page">
      <h1>My Dashboard</h1>

      <section className="analytics-section">
        <div className="date-range-header">
          <h3>Business Overview</h3>
          <button className="date-picker-button" onClick={() => setShowDatePicker(!showDatePicker)}>
            {`${format(dateRange[0].startDate, 'MMM d, yyyy')} - ${format(dateRange[0].endDate, 'MMM d, yyyy')}`}
          </button>
        </div>

        {showDatePicker && (
          <div className="date-picker-wrapper">
             <div className="date-picker-popover">
                <DateRange
                    editableDateInputs={true}
                    onChange={item => {
                        setDateRange([item.selection]);
                        setShowDatePicker(false);
                    }}
                    moveRangeOnFirstSelection={false}
                    ranges={dateRange}
                    maxDate={new Date()}
                />
            </div>
          </div>
        )}

        <div className="stats-grid">
          <div className="stat-card"><h4>Total Revenue</h4><p>₹{stats.totalRevenue}</p></div>
          <div className="stat-card"><h4>Total Orders</h4><p>{stats.totalOrders}</p></div>
          <div className="stat-card"><h4>Average Order Value</h4><p>₹{stats.avgOrderValue}</p></div>
        </div>

        <div className="chart-container">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(value) => `₹${value.toFixed(2)}`} />
                <Legend />
                <Bar dataKey="Sales" fill="#FBBF24" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="menu-management-section">
        <h2>Menu Management</h2>
        <div className="dashboard-content">
          <div className="add-item-form">
            <h3>{isEditing ? 'Edit Menu Item' : 'Add New Menu Item'}</h3>
            <form onSubmit={handleSubmit}>
              <div className="form-group"><label>Item Name</label><input type="text" value={itemName} onChange={(e) => setItemName(e.target.value)} required /></div>
              <div className="form-group"><label>Price</label><input type="number" value={price} onChange={(e) => setPrice(e.target.value)} required /></div>
              <div className="form-group"><label>Description</label><textarea value={description} onChange={(e) => setDescription(e.target.value)} required /></div>
              <button type="submit" className="auth-button">{isEditing ? 'Update Item' : 'Add Item'}</button>
              {isEditing && <button type="button" className="cancel-btn" onClick={clearForm}>Cancel Edit</button>}
            </form>
          </div>
          <div className="my-menu-list">
            <h3>My Menu</h3>
            {menuItems.map(item => (
              <div key={item.id} className="menu-item-card">
                <div className="item-details">
                  <h4>{item.ItemName}</h4><p>₹{item.Price}</p><p>{item.Description}</p>
                </div>
                <div className="item-actions">
                  <button onClick={() => handleEditClick(item)}>Edit</button>
                  <button onClick={() => handleDeleteClick(item.id)} className="delete-btn">Delete</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

export default Dashboard;
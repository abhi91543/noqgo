import { useState, useEffect } from 'react';
import { db, auth } from '../firebaseConfig';
import { collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { DateRange } from 'react-date-range';
import { addDays, format, eachDayOfInterval, isWithinInterval } from 'date-fns';
import 'react-date-range/dist/styles.css';
import 'react-date-range/dist/theme/default.css';
import './Dashboard.css';
import MenuManagement from '../components/MenuManagement';

function Dashboard() {
  const [allOrders, setAllOrders] = useState([]);
  const [stats, setStats] = useState({ totalRevenue: 0, totalOrders: 0, avgOrderValue: 0 });
  const [chartData, setChartData] = useState([]);
  const [topItems, setTopItems] = useState([]);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [dateRange, setDateRange] = useState([
    { startDate: addDays(new Date(), -6), endDate: new Date(), key: 'selection' }
  ]);

  useEffect(() => {
    if (auth.currentUser) {
      const ordersQuery = query(collection(db, "Orders"), where("ownerId", "==", auth.currentUser.uid));
      // Using onSnapshot for real-time updates to the dashboard
      const unsubscribe = onSnapshot(ordersQuery, (snapshot) => {
        setAllOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      });
      return () => unsubscribe(); // Cleanup listener on component unmount
    }
  }, []);

  useEffect(() => {
    const startDate = dateRange[0].startDate;
    const endDate = dateRange[0].endDate;
    const filteredOrders = allOrders.filter(order => order.timestamp && isWithinInterval(order.timestamp.toDate(), { start: startDate, end: endDate }));

    if (filteredOrders.length > 0) {
      const totalRevenue = filteredOrders.reduce((sum, order) => sum + order.totalAmount, 0);
      setStats({
        totalRevenue: totalRevenue.toFixed(2),
        totalOrders: filteredOrders.length,
        avgOrderValue: (totalRevenue / filteredOrders.length).toFixed(2)
      });
      
      const itemCounts = filteredOrders.flatMap(order => order.items).reduce((acc, item) => {
        acc[item.ItemName] = (acc[item.ItemName] || 0) + item.quantity;
        return acc;
      }, {});
      const sortedItems = Object.entries(itemCounts).sort(([, a], [, b]) => b - a).slice(0, 5);
      setTopItems(sortedItems);

      const salesByDay = filteredOrders.reduce((acc, order) => {
        const day = format(order.timestamp.toDate(), 'yyyy-MM-dd');
        acc[day] = (acc[day] || 0) + order.totalAmount;
        return acc;
      }, {});
      const intervalDays = eachDayOfInterval({ start: startDate, end: endDate });
      const formattedChartData = intervalDays.map(day => {
        const formattedDay = format(day, 'yyyy-MM-dd');
        return { name: format(day, 'MMM d'), Sales: salesByDay[formattedDay] || 0 };
      });
      setChartData(formattedChartData);
    } else {
      setStats({ totalRevenue: 0, totalOrders: 0, avgOrderValue: 0 });
      setChartData([]);
      setTopItems([]);
    }
  }, [dateRange, allOrders]);

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
          <div className="date-picker-wrapper"><div className="date-picker-popover">
            <DateRange
                editableDateInputs={true}
                onChange={item => { setDateRange([item.selection]); setShowDatePicker(false); }}
                moveRangeOnFirstSelection={false}
                ranges={dateRange}
                maxDate={new Date()}
            />
          </div></div>
        )}
        <div className="stats-grid">
          <div className="stat-card"><h4>Total Revenue</h4><p>₹{stats.totalRevenue}</p></div>
          <div className="stat-card"><h4>Total Orders</h4><p>{stats.totalOrders}</p></div>
          <div className="stat-card"><h4>Average Order Value</h4><p>₹{stats.avgOrderValue}</p></div>
        </div>
        <div className="dashboard-main-analytics">
          <div className="chart-container">
            <h3>Sales Chart</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis tickFormatter={(value) => `₹${value}`} /><Tooltip formatter={(value) => `₹${value.toFixed(2)}`} /><Legend /><Bar dataKey="Sales" fill="#FBBF24" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="top-items-container">
            <h3>Top Selling Items</h3>
            {topItems.length > 0 ? (
              topItems.map(([name, count]) => (
                <div key={name} className="top-item">
                  <span className="top-item-name">{name}</span>
                  <span className="top-item-count">{count} sold</span>
                </div>
              ))
            ) : (<p>No sales in this period.</p>)}
          </div>
        </div>
      </section>
      <section className="menu-management-section">
        <h2>Menu Management</h2>
        <MenuManagement />
      </section>
    </div>
  );
}

export default Dashboard;
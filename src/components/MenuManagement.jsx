import { useState, useEffect } from 'react';
import { db, auth } from '../firebaseConfig';
import { collection, addDoc, query, where, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import './MenuManagement.css'; // Import the new stylesheet

function MenuManagement() {
  const [menuItems, setMenuItems] = useState([]);
  const [itemName, setItemName] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [currentItemId, setCurrentItemId] = useState(null);

  useEffect(() => {
    if (auth.currentUser) {
      const q = query(collection(db, "Menu"), where("ownerId", "==", auth.currentUser.uid));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setMenuItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      });
      return () => unsubscribe();
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const itemData = {
      ownerId: auth.currentUser.uid,
      ItemName: itemName,
      Price: Number(price),
      Description: description,
    };

    if (isEditing) {
      const itemDocRef = doc(db, 'Menu', currentItemId);
      await updateDoc(itemDocRef, itemData);
      alert("Item updated successfully!");
    } else {
      await addDoc(collection(db, 'Menu'), itemData);
      alert("Item added successfully!");
    }
    resetForm();
  };

  const handleEdit = (item) => {
    setIsEditing(true);
    setCurrentItemId(item.id);
    setItemName(item.ItemName);
    setPrice(item.Price);
    setDescription(item.Description);
  };

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this item?")) {
      const itemDocRef = doc(db, 'Menu', id);
      await deleteDoc(itemDocRef);
      alert("Item deleted successfully!");
    }
  };

  const resetForm = () => {
    setIsEditing(false);
    setCurrentItemId(null);
    setItemName('');
    setPrice('');
    setDescription('');
  };

  return (
    <div className="menu-management-layout">
      <div className="add-item-form">
        <h3>{isEditing ? 'Edit Menu Item' : 'Add New Menu Item'}</h3>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Item Name</label>
            <input type="text" value={itemName} onChange={(e) => setItemName(e.target.value)} required />
          </div>
          <div className="form-group">
            <label>Price</label>
            <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} required />
          </div>
          <div className="form-group">
            <label>Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} required></textarea>
          </div>
          <button type="submit" className="auth-button">{isEditing ? 'Update Item' : 'Add Item'}</button>
          {isEditing && <button type="button" className="secondary-button" onClick={resetForm}>Cancel Edit</button>}
        </form>
      </div>
      <div className="my-menu-section">
        <h3>My Menu</h3>
        <div className="my-menu-grid">
          {menuItems.map(item => (
            <div key={item.id} className="menu-item-card">
              <h4>{item.ItemName}</h4>
              <p className="price">₹{item.Price}</p>
              <p className="description">{item.Description}</p>
              <div className="menu-item-actions">
                <button onClick={() => handleEdit(item)} className="edit-btn">Edit</button>
                <button onClick={() => handleDelete(item.id)} className="delete-btn">Delete</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default MenuManagement;
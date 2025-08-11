import { useState, useEffect } from 'react';
import { db, auth } from '../firebaseConfig';
import { collection, addDoc, query, where, getDocs, serverTimestamp, doc, updateDoc, deleteDoc } from 'firebase/firestore';

// List of forbidden keywords
const forbiddenKeywords = [
  'cigarette', 'cigar', 'tobacco', 'pan', 'gutkha', 'khaini', 'smokes', 'vape', 'e-cig', 'hookah',
  'gold flake', 'kings', 'classic', 'wills navy cut', 'four square', 'red & white',
  'charminar', 'vimal', 'rajnigandha', 'pan parag', 'kamla pasand', 'baba',
  'beer', 'wine', 'vodka', 'whiskey', 'rum', 'alcohol', 'liquor', 'brandy', 'gin', 'breezer',
  'kingfisher', 'royal stag', 'officers choice', 'imperial blue', 'blenders pride', 'mcdowell', 'old monk'
];

function MenuManagement() {
  const [menuItems, setMenuItems] = useState([]);
  const [itemName, setItemName] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [currentItemId, setCurrentItemId] = useState(null);

  const fetchMyMenu = async () => {
    if (auth.currentUser) {
      const q = query(collection(db, "Menu"), where("ownerId", "==", auth.currentUser.uid));
      const querySnapshot = await getDocs(q);
      const itemsList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMenuItems(itemsList);
    }
  };

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(user => {
      if (user) {
        fetchMyMenu();
      } else {
        setMenuItems([]);
      }
    });
    return () => unsubscribe();
  }, []);

  const clearForm = () => {
    setItemName('');
    setPrice('');
    setDescription('');
    setIsEditing(false);
    setCurrentItemId(null);
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
      try {
        await updateDoc(itemDocRef, { ItemName: itemName, Price: Number(price), Description: description });
        alert("Item updated successfully!");
        clearForm();
        fetchMyMenu();
      } catch (error) {
        alert("Failed to update item.");
      }
    } else {
      const newItem = {
        ItemName: itemName,
        Price: Number(price),
        Description: description,
        ownerId: auth.currentUser.uid,
        createdAt: serverTimestamp()
      };
      try {
        await addDoc(collection(db, "Menu"), newItem);
        alert("Item added successfully!");
        clearForm();
        fetchMyMenu();
      } catch (error) {
        alert("Failed to add item.");
      }
    }
  };

  const handleEditClick = (item) => {
    setIsEditing(true);
    setCurrentItemId(item.id);
    setItemName(item.ItemName);
    setPrice(item.Price);
    setDescription(item.Description);
  };

  const handleDeleteClick = async (itemId) => {
    if (window.confirm("Are you sure you want to delete this item?")) {
      const itemDocRef = doc(db, 'Menu', itemId);
      try {
        await deleteDoc(itemDocRef);
        alert("Item deleted successfully!");
        fetchMyMenu();
      } catch (error) {
        alert("Failed to delete item.");
      }
    }
  };

  return (
    <div className="dashboard-content">
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
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} required />
          </div>
          <button type="submit" className="auth-button">
            {isEditing ? 'Update Item' : 'Add Item'}
          </button>
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
  );
}

export default MenuManagement;
import { doc, setDoc } from "firebase/firestore";
import { db } from "../firebaseConfig";  // adjust path if your config file is elsewhere

export const saveOwnerData = async (userData) => {
  try {
    await setDoc(doc(db, "owners", userData.uid), userData);
    console.log("Owner data saved successfully");
  } catch (error) {
    console.error("Error saving owner data:", error);
  }
};

// Firebase Imports
const { onRequest } = require("firebase-functions/v2/https");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const axios = require("axios");

// Third-party Imports
const Razorpay = require("razorpay");
const cors = require("cors")({ origin: true });

// --- INITIALIZATIONS ---
admin.initializeApp();

const razorpayInstance = new Razorpay({
  key_id: "rzp_test_Sau6n14kXnINu7",
  key_secret: "v4jVQ9WrLd9ECIzv7rrBaVmX",
});

// ===================================================================
// =================== PAYMENT ROUTING FUNCTION ======================
// ===================================================================
exports.createRazorpayOrder = onRequest({ region: "asia-south1" }, (request, response) => {
  cors(request, response, async () => {
    try {
      const { amount, venueId } = request.body;
      if (!amount || !venueId) {
        logger.error("Missing amount or venueId in request.", { body: request.body });
        return response.status(400).send("Amount and Venue ID are required.");
      }
      const venueDocRef = admin.firestore().collection("Locations").doc(venueId);
      const venueDoc = await venueDocRef.get();
      if (!venueDoc.exists) {
        logger.error(`Venue with ID ${venueId} not found.`);
        return response.status(404).send("Venue not found.");
      }
      const venueData = venueDoc.data();
      const linkedAccountId = venueData.razorpay?.accountId;
      const commissionRate = venueData.feeConfiguration?.buzzOrdersCommission || 2.5;
      if (!linkedAccountId) {
        logger.error(`Venue ${venueId} does not have a linked Razorpay account.`);
        return response.status(400).send("This venue is not set up to receive payments.");
      }
      const totalAmount = parseInt(amount, 10);
      const commissionAmount = Math.round(totalAmount * (commissionRate / 100));
      const transferAmount = totalAmount - commissionAmount;
      const options = {
        amount: totalAmount,
        currency: "INR",
        receipt: `receipt_order_${new Date().getTime()}`,
        transfers: [
          {
            account: linkedAccountId,
            amount: transferAmount,
            currency: "INR",
          },
        ],
      };
      const order = await razorpayInstance.orders.create(options);
      logger.info(`Created Razorpay order ${order.id} for venue ${venueId} with split.`);
      return response.status(200).send(order);
    } catch (error) {
      logger.error("Razorpay order creation error:", error);
      return response.status(500).send("Error creating payment order.");
    }
  });
});

// --- "SMART" ADD/PROMOTE STAFF FUNCTION ---
exports.addOrPromoteStaff = onCall(async (request) => {
  if (!request.auth) { throw new HttpsError("unauthenticated", "You must be logged in."); }
  const requesterDoc = await admin.firestore().collection("users").doc(request.auth.uid).get();
  if (requesterDoc.data().role?.toLowerCase() !== "owner" && requesterDoc.data().role?.toLowerCase() !== "superadmin") {
    throw new HttpsError("permission-denied", "Only owners or super admins can manage staff.");
  }
  const { email, name, phone } = request.data;
  if (!email || !name) { throw new HttpsError("invalid-argument", "Email and Name are required.");}
  try {
    const userRecord = await admin.auth().getUserByEmail(email);
    await admin.firestore().collection("users").doc(userRecord.uid).update({ role: "staff", displayName: name, phone: phone || "" });
    return { success: true, message: `${name} (${email}) has been promoted to staff.` };
  } catch (error) {
    if (error.code === 'auth/user-not-found') {
      const newUserRecord = await admin.auth().createUser({ email, displayName: name });
      await admin.firestore().collection("users").doc(newUserRecord.uid).set({
        uid: newUserRecord.uid, displayName: name, email, phone: phone || "", role: "staff",
        createdAt: admin.firestore.FieldValue.serverTimestamp(), availability: "available", assignedOrdersCount: 0,
      });
      const link = await admin.auth().generatePasswordResetLink(email);
      await admin.firestore().collection("mail").add({
        to: email,
        message: {
          subject: "You've been invited to join the team!",
          html: `Hello ${name},<br><br>You have been invited to join our team. Please set your password by clicking the link below:<br><br><a href="${link}">Set Your Password</a><br><br>Thank you!`,
        },
      });
      return { success: true, message: `An invitation email has been sent to ${email}.` };
    }
    throw new HttpsError("internal", error.message);
  }
});

// --- OTHER STAFF & ORDER FUNCTIONS ---
exports.updateStaffUser = onCall(async (request) => {
  if (!request.auth) { throw new HttpsError("unauthenticated", "You must be logged in."); }
  const requesterDoc = await admin.firestore().collection("users").doc(request.auth.uid).get();
  if (requesterDoc.data().role?.toLowerCase() !== "owner" && requesterDoc.data().role?.toLowerCase() !== "superadmin") { throw new HttpsError("permission-denied", "Only owners or super admins can edit users.");}
  const { uid, displayName, phone } = request.data;
  if (!uid || !displayName) { throw new HttpsError("invalid-argument", "UID and displayName are required.");}
  try {
    await admin.auth().updateUser(uid, { displayName });
    await admin.firestore().collection("users").doc(uid).update({ displayName, phone: phone || "" });
    return { success: true, message: "Staff member updated successfully." };
  } catch (error) { throw new HttpsError("internal", "Failed to update staff member."); }
});

exports.deleteStaffUser = onCall(async (request) => {
  if (!request.auth) { throw new HttpsError("unauthenticated", "You must be logged in."); }
  const requesterDoc = await admin.firestore().collection("users").doc(request.auth.uid).get();
  if (requesterDoc.data().role?.toLowerCase() !== "owner" && requesterDoc.data().role?.toLowerCase() !== "superadmin") { throw new HttpsError("permission-denied", "Only owners or super admins can delete users."); }
  const staffUid = request.data.uid;
  if (!staffUid) { throw new HttpsError("invalid-argument", "The function must be called with a 'uid' argument."); }
  try {
    await admin.auth().deleteUser(staffUid);
    await admin.firestore().collection("users").doc(staffUid).delete();
    return { success: true, message: "Staff member removed successfully." };
  } catch (error) { throw new HttpsError("internal", "Failed to remove staff member.", error); }
});

exports.autoAssignOrder = onDocumentCreated("Orders/{orderId}", async (event) => {
  const newOrderSnapshot = event.data;
  if (!newOrderSnapshot) { return; }
  const orderId = newOrderSnapshot.id;
  try {
    const staffQuery = admin.firestore().collection("users").where("role", "==", "staff").where("availability", "==", "available").orderBy("assignedOrdersCount", "asc").limit(1);
    const staffSnapshot = await staffQuery.get();
    if (staffSnapshot.empty) {
      await newOrderSnapshot.ref.update({ status: "Paid - Unassigned" });
      return;
    }
    const bestStaffMember = staffSnapshot.docs[0];
    await newOrderSnapshot.ref.update({ assignedStaffId: bestStaffMember.id, status: "Paid - Assigned" });
    await bestStaffMember.ref.update({ assignedOrdersCount: admin.firestore.FieldValue.increment(1) });
  } catch (error) {
    logger.error(`Error assigning order ${orderId}:`, error);
    await newOrderSnapshot.ref.update({ status: "Assignment Error" }).catch(() => {});
  }
});

// --- FEE SETTINGS FUNCTION ---
exports.updateFeeConfiguration = onRequest({ region: "asia-south1" }, (request, response) => {
  cors(request, response, async () => {
    try {
      if (!request.headers.authorization || !request.headers.authorization.startsWith('Bearer ')) {
        logger.error("No Firebase ID token was passed.");
        response.status(403).send('Unauthorized');
        return;
      }
      const idToken = request.headers.authorization.split('Bearer ')[1];
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      const uid = decodedToken.uid;
      const data = request.body.data || request.body;
      const { venueId, feePayer } = data;
      if (!venueId || !feePayer) {
        logger.error("Missing venueId or feePayer in request.", { body: request.body });
        response.status(400).send({error: {message: "Bad Request", status: "INVALID_ARGUMENT"}});
        return;
      }
      const venueRef = admin.firestore().collection("Locations").doc(venueId);
      const venueDoc = await venueRef.get();
      if (!venueDoc.exists || venueDoc.data().ownerId !== uid) {
        response.status(403).send("Permission denied.");
        return;
      }
      await venueRef.update({
        "feeConfiguration.feePayer": feePayer,
        "feeConfiguration.buzzOrdersCommission": 2.5,
        "feeConfiguration.lastUpdated": admin.firestore.FieldValue.serverTimestamp(),
      });
      logger.info(`Successfully updated fee config for venue ${venueId}`);
      response.status(200).send({ status: "success", message: "Configuration updated." });
    } catch (error) {
      logger.error("Error updating fee configuration:", error);
      response.status(500).send("An unexpected error occurred.");
    }
  });
});

// --- RAZORPAY ONBOARDING FUNCTION (FINAL FIX) ---
exports.createRazorpayLinkedAccount = onCall({ region: "asia-south1" }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in.");
  }
  const uid = request.auth.uid;
  const { venueId } = request.data;
  if (!venueId) {
    throw new HttpsError("invalid-argument", "The function must be called with a 'venueId'.");
  }
  try {
    const userDoc = await admin.firestore().collection("users").doc(uid).get();
    const venueDoc = await admin.firestore().collection("Locations").doc(venueId).get();
    if (!userDoc.exists || !venueDoc.exists || venueDoc.data().ownerId !== uid) {
      throw new HttpsError("permission-denied", "You do not have permission to perform this action.");
    }
    const userData = userDoc.data();
    const venueData = venueDoc.data();
    if (!userData.phone || !userData.email || !userData.displayName || !userData.businessType || userData.businessType === 'none') {
        throw new HttpsError("failed-precondition", "Your user profile must have all required details.");
    }
    const formattedPhone = userData.phone.replace(/\D/g, '').slice(-10);
    const businessName = venueData.name || userData.displayName;

    // --- THIS IS THE FINAL FIX ---
    // This payload includes all fields that Razorpay has asked for, structured correctly.
    const accountDetails = {
      type: "route",
      email: userData.email,
      phone: formattedPhone,
      tnc_accepted: true,
      profile: {
        name: businessName,
        legal_business_name: businessName,
        business_type: "proprietorship",
      }
    };
    // --- END OF FIX ---

    const razorpayAccount = await razorpayInstance.accounts.create(accountDetails);
    
    await admin.firestore().collection("Locations").doc(venueId).update({
      "razorpay.accountId": razorpayAccount.id,
      "razorpay.status": "created",
    });
    logger.info(`Created Razorpay Linked Account ${razorpayAccount.id} for venue ${venueId}`);
    return {
      success: true,
      accountId: razorpayAccount.id,
    };
  } catch (error) {
    logger.error("Error creating Razorpay Linked Account:", {
        errorMessage: error.message,
        errorDetails: error.error, 
    });
    throw new HttpsError("internal", error.error?.description || "Could not create a Razorpay account at this time.");
  }
});

// --- NEW DIALOGUE FUNCTION ---
exports.getDialogueForLocation = onRequest({ region: "asia-south1" }, (request, response) => {
  cors(request, response, async () => {
    try {
      const { lat, lon } = request.query;
      if (!lat || !lon) {
        return response.status(400).send("Latitude (lat) and Longitude (lon) are required.");
      }
      const geoApiUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1`;
      const geoResponse = await axios.get(geoApiUrl, {
        headers: { 'User-Agent': 'BuzzOrders/1.0' }
      });
      const address = geoResponse.data.address;
      const state = address.state;
      const dialogues = {
        "Andhra Pradesh": "ఏం కావాలి అన్నా/అక్కా? (Welcome anna/akka!)",
        "Telangana": "ఏం కావాలి అన్నా/అక్కా? (Welcome anna/akka!)",
        "Karnataka": "ಏನು ಬೇಕು? (What would you like?)",
        "Tamil Nadu": "என்ன வேண்டும்? (What would you like?)",
        "Maharashtra": "काय पाहिजे? (What would you like?)",
        "West Bengal": "কি চাই? (What would you like?)",
        "Delhi": "क्या चाहिए? (What would you like?)",
      };
      const dialogue = dialogues[state] || "Welcome! What would you like to order?";
      return response.status(200).send({ dialogue: dialogue, state: state });
    } catch (error) {
      logger.error("Error getting dialogue for location:", error);
      return response.status(500).send({ dialogue: "Welcome! What would you like to order?" });
    }
  });
});
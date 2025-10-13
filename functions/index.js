// functions/index.js

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require('firebase-functions/params');
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const Razorpay = require("razorpay");

admin.initializeApp();

const RAZORPAY_KEY_ID = defineSecret('RAZORPAY_KEY_ID');
const RAZORPAY_KEY_SECRET = defineSecret('RAZORPAY_KEY_SECRET');

// --- STEP 1: CREATE LINKED ACCOUNT ---
exports.createRazorpayLinkedAccount = onCall({
  region: "asia-south1",
  secrets: ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET"]
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in.");
  }
  
  const razorpayInstance = new Razorpay({
    key_id: RAZORPAY_KEY_ID.value(),
    key_secret: RAZORPAY_KEY_SECRET.value(),
  });

  const { venueId } = request.data;
  if (!venueId) {
    throw new HttpsError("invalid-argument", "Venue ID is required.");
  }

  const uid = request.auth.uid;

  try {
    const userDoc = await admin.firestore().collection("users").doc(uid).get();
    const venueDoc = await admin.firestore().collection("Locations").doc(venueId).get();

    if (!userDoc.exists || !venueDoc.exists || venueDoc.data().ownerId !== uid) {
      throw new HttpsError("permission-denied", "You don't have permission.");
    }
    const userData = userDoc.data();
    const venueData = venueDoc.data();
    const businessName = venueData.name || userData.displayName;

    const accountDetails = {
      type: "route",
      email: userData.email,
      phone: userData.phone.replace(/\D/g, '').slice(-10),
      tnc_accepted: true,
      profile: {
        name: businessName,
        legal_business_name: businessName,
        business_type: "proprietorship",
      }
    };
    
    const razorpayAccount = await razorpayInstance.accounts.create(accountDetails);
    
    await admin.firestore().collection("Locations").doc(venueId).update({
      "razorpay.accountId": razorpayAccount.id,
      "razorpay.status": "created",
    });

    logger.info(`Step 1 Success: Created LA ${razorpayAccount.id} for venue ${venueId}`);
    return { success: true, accountId: razorpayAccount.id };

  } catch (error) {
    logger.error("Error in createRazorpayLinkedAccount:", error);
    throw new HttpsError("internal", error.error?.description || "Could not create Razorpay account.");
  }
});

// --- STEP 2: CREATE STAKEHOLDER ---
exports.createStakeholder = onCall({
  region: "asia-south1",
  secrets: ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET"]
}, async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "You must be logged in.");

    const razorpayInstance = new Razorpay({
        key_id: RAZORPAY_KEY_ID.value(),
        key_secret: RAZORPAY_KEY_SECRET.value(),
    });
    
    const { accountId, name, email, pan } = request.data;
    if (!accountId || !name || !email || !pan) {
        throw new HttpsError("invalid-argument", "Missing required stakeholder details.");
    }

    try {
        const stakeholder = await razorpayInstance.stakeholders.create({
            account_id: accountId,
            stakeholder: {
                name: name,
                email: email,
                pan: pan,
            }
        });
        logger.info(`Step 2 Success: Created Stakeholder ${stakeholder.id} for LA ${accountId}`);
        return { success: true, stakeholderId: stakeholder.id };
    } catch (error) {
        logger.error("Error in createStakeholder:", error);
        throw new HttpsError("internal", error.error?.description || "Could not create stakeholder.");
    }
});

// --- STEP 3: REQUEST PRODUCT CONFIGURATION ---
exports.requestProductConfiguration = onCall({
  region: "asia-south1",
  secrets: ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET"]
}, async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "You must be logged in.");

    const razorpayInstance = new Razorpay({
        key_id: RAZORPAY_KEY_ID.value(),
        key_secret: RAZORPAY_KEY_SECRET.value(),
    });

    const { accountId } = request.data;
    if (!accountId) throw new HttpsError("invalid-argument", "Account ID is required.");

    try {
        await razorpayInstance.accounts.requestProductConfiguration(accountId, {
            product_name: "route"
        });
        logger.info(`Step 3 Success: Requested product config for LA ${accountId}`);
        return { success: true };
    } catch (error) {
        logger.error("Error in requestProductConfiguration:", error);
        throw new HttpsError("internal", error.error?.description || "Could not request product config.");
    }
});

// --- STEP 4: UPDATE PRODUCT CONFIGURATION (BANK DETAILS) ---
exports.updateProductConfiguration = onCall({
  region: "asia-south1",
  secrets: ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET"]
}, async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "You must be logged in.");

    const razorpayInstance = new Razorpay({
        key_id: RAZORPAY_KEY_ID.value(),
        key_secret: RAZORPAY_KEY_SECRET.value(),
    });

    const { accountId, bankAccountName, bankAccountNumber, bankIfsc } = request.data;
    if (!accountId || !bankAccountName || !bankAccountNumber || !bankIfsc) {
        throw new HttpsError("invalid-argument", "Missing required bank details.");
    }

    try {
        await razorpayInstance.accounts.updateProductConfiguration(accountId, "route", {
            bank_account: {
                beneficiary_name: bankAccountName,
                account_number: bankAccountNumber,
                ifsc_code: bankIfsc
            }
        });
        
        // Final step: Update status in Firestore
        const venueQuery = await admin.firestore().collection("Locations").where("razorpay.accountId", "==", accountId).limit(1).get();
        if (!venueQuery.empty) {
            const venueDoc = venueQuery.docs[0];
            await venueDoc.ref.update({ "razorpay.status": "activated" });
        }

        logger.info(`Step 4 Success: Updated bank details for LA ${accountId}. Status set to activated.`);
        return { success: true };

    } catch (error) {
        logger.error("Error in updateProductConfiguration:", error);
        throw new HttpsError("internal", error.error?.description || "Could not update bank details.");
    }
});
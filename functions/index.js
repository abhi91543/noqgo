const {onRequest} = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const Razorpay = require("razorpay");

// Initialize Razorpay with your Test Keys
const razorpayInstance = new Razorpay({
  key_id: "rzp_test_Sau6n14kXnINu7", // Your Key ID
  key_secret: "v4jVQ9WrLd9ECIzv7rrBaVmX", // Your Key Secret
});

/**
 * A simple test function
 */
exports.helloWorld = onRequest((request, response) => {
  logger.info("Hello world function was called!");
  response.send("Hello from Interval's Firebase function!");
});

/**
 * The Razorpay function
 */
exports.createRazorpayOrder = onRequest({cors: true}, async (request, response) => {
  try {
    const amount = request.body.amount;

    const options = {
      amount: amount, // Amount is in paise
      currency: "INR",
      receipt: `receipt_order_${new Date().getTime()}`,
    };

    const order = await razorpayInstance.orders.create(options);

    logger.info("Razorpay order created successfully", {orderId: order.id});
    response.status(200).send(order);

  } catch (error) {
    logger.error("Razorpay order creation error:", error);
    response.status(500).send(error);
  }
});
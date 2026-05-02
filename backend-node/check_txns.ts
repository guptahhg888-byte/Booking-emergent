import { connectDB, db } from './src/core/database';
import mongoose from 'mongoose';

(async () => {
  await connectDB();
  const txns = await db.transactions().find().sort({ created_at: -1 }).limit(5).toArray();
  for (const txn of txns) {
    console.log("Transaction:", txn.transaction_id);
    console.log("API Error:", txn.api_error);
    console.log("Payment State:", txn.payment_state);
    console.log("Checkout URL:", txn.checkout_url);
    console.log("-------------------");
  }
  await mongoose.disconnect();
})();

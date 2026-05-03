const crypto = require('crypto');
const axios = require('axios');

async function testPG() {
  const merchantId = 'PGTESTPAYUAT86';
  const saltKey = '96434309-7796-489d-8924-ab56988a6076';
  const saltIndex = '1';

  const payload = {
    merchantId: merchantId,
    merchantTransactionId: 'MT' + Date.now(),
    merchantUserId: 'MUID123',
    amount: 10000,
    redirectUrl: 'http://localhost:3000/payment/status',
    redirectMode: 'REDIRECT',
    callbackUrl: 'http://localhost:8000/api/payments/webhook',
    mobileNumber: '9999999999',
    paymentInstrument: {
      type: 'PAY_PAGE'
    }
  };

  const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64');
  const str = base64Payload + '/pg/v1/pay' + saltKey;
  const sha256 = crypto.createHash('sha256').update(str).digest('hex');
  const checksum = sha256 + '###' + saltIndex;

  try {
    const res = await axios.post('https://api-preprod.phonepe.com/apis/pg-sandbox/pg/v1/pay', 
      { request: base64Payload }, 
      { headers: { 'Content-Type': 'application/json', 'X-VERIFY': checksum } }
    );
    console.log("Success:", JSON.stringify(res.data, null, 2));
  } catch (err) {
    console.log("Error:", err.response ? JSON.stringify(err.response.data, null, 2) : err.message);
  }
}
testPG();

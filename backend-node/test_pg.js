const crypto = require('crypto');
const axios = require('axios');

async function testPG() {
  const merchantId = 'PGTESTPAYUAT';
  const saltKey = '099eb0cd-02cf-4e2a-8aca-3e6c6aff0399';
  const saltIndex = '1';

  const payload = {
    merchantId: merchantId,
    merchantTransactionId: 'MT7850590068188104',
    merchantUserId: 'MUID123',
    amount: 10000,
    redirectUrl: 'https://webhook.site/redirect-url',
    redirectMode: 'REDIRECT',
    callbackUrl: 'https://webhook.site/callback-url',
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
    console.log("Success:", res.data);
  } catch (err) {
    console.log("Error:", err.response ? err.response.data : err.message);
  }
}
testPG();

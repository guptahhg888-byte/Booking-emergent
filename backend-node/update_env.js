const fs = require('fs');
const envPath = '.env';
let env = fs.readFileSync(envPath, 'utf8');

// Replace PhonePe OAuth variables with Standard PG variables
env = env.replace(/PHONEPE_MERCHANT_ID=.*/, 'PHONEPE_MERCHANT_ID="PGTESTPAYUAT86"');
env = env.replace(/PHONEPE_CLIENT_ID=.*/, 'PHONEPE_SALT_KEY="96434309-7796-489d-8924-ab56988a6076"');
env = env.replace(/PHONEPE_CLIENT_VERSION=.*/, 'PHONEPE_SALT_INDEX="1"');
env = env.replace(/PHONEPE_CLIENT_SECRET=.*/, '');

fs.writeFileSync(envPath, env);
console.log('.env updated with Standard PG test credentials');

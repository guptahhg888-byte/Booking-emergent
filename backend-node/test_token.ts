import { getPhonepeToken } from './src/services/phonepe';

(async () => {
  const token = await getPhonepeToken();
  console.log("Token:", token);
})();

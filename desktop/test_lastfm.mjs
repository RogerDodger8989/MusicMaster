import axios from 'axios';

const BASE_URL = 'http://ws.audioscrobbler.com/2.0/';
const API_KEY = process.env.LASTFM_API_KEY || 'cb46099adc59d61986db4f71c4ab8387';

async function testLastFmAuth() {
  console.log('🧪 Testing Last.fm API...');
  console.log('API Key:', API_KEY.substring(0, 8) + '...');
  
  try {
    const params = {
      method: 'auth.getToken',
      api_key: API_KEY,
      format: 'json'
    };
    
    console.log('📤 Sending request to:', BASE_URL);
    const response = await axios.get(BASE_URL, { params, timeout: 10000 });
    console.log('✅ Success! Response:');
    console.log(JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('❌ Error:');
    if (axios.isAxiosError(error)) {
      console.error('- Message:', error.message);
      console.error('- Code:', error.code);
      console.error('- Status:', error.response?.status);
      console.error('- Data:', error.response?.data);
    } else {
      console.error('- Error:', error);
    }
  }
}

testLastFmAuth();

const fetch = require('node-fetch');

// Popular System of a Down songs that should have AcousticBrainz data
const testRecordings = [
  '9976f567-f267-4d2e-9792-2e5ae5618e7c',  // Chic 'n' Stu
  '834c1cf4-2ba9-4b77-969d-6ac087e4b7f1',  // Innervision  
];

async function checkAcousticBrainz() {
  console.log('Testing AcousticBrainz for known recordings...\n');
  
  for (const mbid of testRecordings) {
    try {
      const response = await fetch(`https://acousticbrainz.org/api/v1/${mbid}/high-level`);
      const data = await response.json();
      
      if (response.ok) {
        console.log(`✅ ${mbid}`);
        console.log(`   Has: ${Object.keys(data).join(', ')}`);
      } else {
        console.log(`❌ ${mbid}`);
        console.log(`   Error: ${data.message}`);
      }
    } catch (err) {
      console.log(`❌ ${mbid}`);
      console.log(`   Fetch error: ${err.message}`);
    }
    console.log();
  }
}

checkAcousticBrainz();

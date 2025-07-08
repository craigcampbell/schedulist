const fetch = require('node-fetch');

async function testAPIResponse() {
  try {
    console.log('Testing API endpoint: http://localhost:5050/api/bcba/patients-with-assignments');
    
    // First, let's try to login to get a valid token
    const loginResponse = await fetch('http://localhost:5050/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'bcba@sunshine.com', // Using actual seeded BCBA
        password: 'Password123'
      })
    });
    
    if (!loginResponse.ok) {
      console.error('Login failed:', loginResponse.status, await loginResponse.text());
      return;
    }
    
    const loginData = await loginResponse.json();
    console.log('✅ Login successful');
    
    // Now test the patients endpoint
    const response = await fetch('http://localhost:5050/api/bcba/patients-with-assignments', {
      headers: {
        'Authorization': `Bearer ${loginData.token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      console.error('API call failed:', response.status, await response.text());
      return;
    }
    
    const patients = await response.json();
    console.log('✅ API Response received');
    console.log('Number of patients:', patients.length);
    
    if (patients.length > 0) {
      console.log('\n🔍 First patient data:');
      console.log(JSON.stringify(patients[0], null, 2));
      
      console.log('\n🔍 Patient names in response:');
      patients.slice(0, 3).forEach((patient, index) => {
        console.log(`Patient ${index + 1}: "${patient.firstName}" "${patient.lastName}"`);
      });
    } else {
      console.log('No patients found in response');
    }
    
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

testAPIResponse();
const http = require('http');

function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ data: JSON.parse(body), status: res.statusCode });
        } catch (e) {
          resolve({ data: body, status: res.statusCode });
        }
      });
    });
    req.on('error', reject);
    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function testScheduleAPI() {
  try {
    // Login as BCBA
    const loginResponse = await makeRequest({
      hostname: 'localhost',
      port: 5001,
      path: '/api/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    }, {
      email: 'bcba@sunshine.com',
      password: 'Password123'
    });
    
    const token = loginResponse.data.token;
    
    // Get team schedule for today
    const today = new Date().toISOString();
    const scheduleResponse = await makeRequest({
      hostname: 'localhost',
      port: 5001,
      path: `/api/schedule/teams?date=${today}`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('Team Schedule Response:');
    console.log('Teams:', scheduleResponse.data.teams?.length || 0);
    console.log('Appointments:', scheduleResponse.data.appointments?.length || 0);
    
    if (scheduleResponse.data.teams?.length > 0) {
      console.log('\nTeams:');
      scheduleResponse.data.teams.forEach(team => {
        console.log(`- ${team.name} (Lead: ${team.leadBcba?.firstName} ${team.leadBcba?.lastName})`);
        console.log(`  Members: ${team.members?.length || 0}`);
      });
    }
    
    if (scheduleResponse.data.appointments?.length > 0) {
      console.log('\nFirst 5 appointments:');
      scheduleResponse.data.appointments.slice(0, 5).forEach(app => {
        console.log(`- ${app.title} | ${app.serviceType} | ${new Date(app.startTime).toLocaleString()}`);
        console.log(`  Therapist: ${app.therapist?.firstName} ${app.therapist?.lastName}`);
        console.log(`  Patient: ${app.patient?.firstName || 'No patient'}`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

testScheduleAPI();
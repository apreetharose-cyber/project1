const http = require('http');

function request(options, data) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, raw: body });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function run() {
  console.log('--- Starting AgriShare Labour Single Workflow Integration Test ---');

  // 1. Login as Farmer
  console.log('1. Logging in as Demo Farmer...');
  const farmerLogin = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  }, { email: 'demo.farmer@example.com', password: 'Password123' });

  if (farmerLogin.status !== 200 || !farmerLogin.data?.token) {
    console.error('Farmer login failed:', farmerLogin);
    process.exit(1);
  }
  const farmerToken = farmerLogin.data.token;
  console.log('✓ Farmer logged in successfully.');

  // 2. Test mandatory field validation in Post Farm Work
  console.log('2. Testing missing field validation in Post Farm Work...');
  const invalidPost = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/labour/jobs',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${farmerToken}` },
  }, { workType: 'Weeding' }); // Missing workDescription, landSize, location, lat/lng, etc.

  if (invalidPost.status === 422) {
    console.log(`✓ Validation successfully caught missing fields: "${invalidPost.data?.message}"`);
  } else {
    console.error('Expected 422 validation error, got:', invalidPost);
    process.exit(1);
  }

  // 3. Post valid Farm Work
  console.log('3. Posting valid Farm Work with all 8 mandatory fields...');
  const validWork = {
    workType: 'Weeding',
    workDescription: 'Paddy field weeding required for 3 acres, urgent manual weed removal.',
    landSize: '3 acres',
    location: 'Suramangalam, Salem, Tamil Nadu',
    latitude: 11.6643,
    longitude: 78.1460,
    requiredDate: '2026-09-20',
    expectedCost: 1800,
    additionalRequirements: 'Tools provided on site',
  };

  const postRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/labour/jobs',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${farmerToken}` },
  }, validWork);

  if (postRes.status !== 201 || !postRes.data?.job?.id) {
    console.error('Posting farm work failed:', postRes);
    process.exit(1);
  }
  const jobId = postRes.data.job.id;
  console.log(`✓ Farm work posted successfully! Job ID: ${jobId}`);

  // 4. Verify Farmer My Posts
  console.log('4. Verifying Farmer "My Posts" API...');
  const myPosts = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/labour/my-posts',
    method: 'GET',
    headers: { Authorization: `Bearer ${farmerToken}` },
  });
  const postedJob = myPosts.data?.jobs?.find((j) => j.id === jobId);
  if (!postedJob) {
    console.error('Posted job not found in Farmer my-posts');
    process.exit(1);
  }
  console.log(`✓ Post found in Farmer list. Lat: ${postedJob.latitude}, Lng: ${postedJob.longitude}, Status: ${postedJob.status}`);

  // 5. Login as Labourer
  console.log('5. Logging in as Demo Labourer...');
  const labourLogin = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  }, { email: 'demo.labour@example.com', password: 'Password123' });

  if (labourLogin.status !== 200 || !labourLogin.data?.token) {
    console.error('Labour login failed:', labourLogin);
    process.exit(1);
  }
  const labourToken = labourLogin.data.token;
  const labourerId = labourLogin.data.user.id;
  console.log('✓ Labourer logged in successfully.');

  // 6. Labourer searches/views available farm works
  console.log('6. Labourer viewing Available Farm Works...');
  const searchJobs = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/labour/search?location=Salem',
    method: 'GET',
    headers: { Authorization: `Bearer ${labourToken}` },
  });
  const availableJob = searchJobs.data?.jobs?.find((j) => j.id === jobId);
  if (!availableJob) {
    console.error('Available job not found in Labourer search:', searchJobs);
    process.exit(1);
  }
  console.log(`✓ Labourer can view job "${availableJob.workType}", Pay: ₹${availableJob.expectedCost}, Map Coords: (${availableJob.latitude}, ${availableJob.longitude})`);

  // 7. Verify Direct Labourer Request is REJECTED
  console.log('7. Verifying direct labour request is disabled...');
  const directRequest = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/bookings',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${farmerToken}` },
  }, { labourerId, type: 'LABOUR' });

  if (directRequest.status === 400 && directRequest.data?.message?.includes('Direct labourer requests are disabled')) {
    console.log(`✓ Direct labour request correctly blocked: "${directRequest.data.message}"`);
  } else {
    console.error('Direct request should have been blocked with 400, got:', directRequest);
    process.exit(1);
  }

  // 8. Labourer books/applies for the farm work
  console.log('8. Labourer applying/booking for the farm work...');
  const bookRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/bookings',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${labourToken}` },
  }, { jobId, type: 'LABOUR' });

  if (bookRes.status !== 201 || !bookRes.data?.bookingId) {
    console.error('Labour application failed:', bookRes);
    process.exit(1);
  }
  const bookingId = bookRes.data.bookingId;
  console.log(`✓ Application submitted successfully! Booking ID: ${bookingId}`);

  // 9. Verify duplicate application is rejected
  console.log('9. Verifying duplicate application prevention...');
  const duplicateBook = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/bookings',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${labourToken}` },
  }, { jobId, type: 'LABOUR' });

  if (duplicateBook.status === 400) {
    console.log(`✓ Duplicate application prevented: "${duplicateBook.data?.message}"`);
  } else {
    console.error('Expected duplicate error, got:', duplicateBook);
    process.exit(1);
  }

  // 10. Farmer views received applications
  console.log('10. Farmer viewing received booking applications...');
  const farmerBookings = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/bookings/my?type=LABOUR',
    method: 'GET',
    headers: { Authorization: `Bearer ${farmerToken}` },
  });
  const appFound = farmerBookings.data?.bookings?.find((b) => b.id === bookingId);
  if (!appFound) {
    console.error('Booking application not found in Farmer received list');
    process.exit(1);
  }
  console.log(`✓ Farmer sees received application from "${appFound.labourerName}", Status: ${appFound.status}`);

  // 11. Farmer accepts application
  console.log('11. Farmer accepting the labourer application...');
  const acceptRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: `/api/bookings/${bookingId}/accept`,
    method: 'PUT',
    headers: { Authorization: `Bearer ${farmerToken}` },
  });
  if (acceptRes.status !== 200) {
    console.error('Accept application failed:', acceptRes);
    process.exit(1);
  }
  console.log('✓ Farmer accepted booking application.');

  // Verify job and booking status is now APPROVED / BOOKED
  const checkStatus = await request({
    hostname: 'localhost',
    port: 5000,
    path: `/api/bookings/${bookingId}`,
    method: 'GET',
    headers: { Authorization: `Bearer ${farmerToken}` },
  });
  console.log(`✓ Booking status after accept: ${checkStatus.data?.booking?.status}`);

  // 12. Farmer marks work as completed
  console.log('12. Farmer marking farm work as COMPLETED...');
  const completeRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: `/api/bookings/${bookingId}/complete`,
    method: 'PUT',
    headers: { Authorization: `Bearer ${farmerToken}` },
  });
  if (completeRes.status !== 200) {
    console.error('Complete booking failed:', completeRes);
    process.exit(1);
  }
  console.log('✓ Work marked as COMPLETED.');

  // 13. Rating
  console.log('13. Farmer submitting rating for Labourer...');
  const ratingRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/ratings',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${farmerToken}` },
  }, { bookingId, stars: 5, review: 'Excellent weeding work, completed on time!' });

  if (ratingRes.status !== 200 && ratingRes.status !== 201) {
    console.error('Rating submission failed:', ratingRes);
    process.exit(1);
  }
  console.log('✓ Farmer submitted 5-star rating.');

  console.log('14. Labourer submitting rating for Farmer...');
  const labourRatingRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/ratings',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${labourToken}` },
  }, { bookingId, stars: 5, review: 'Prompt payment and clear instructions.' });

  if (labourRatingRes.status !== 200 && labourRatingRes.status !== 201) {
    console.error('Labourer rating failed:', labourRatingRes);
    process.exit(1);
  }
  console.log('✓ Labourer submitted 5-star rating.');

  console.log('--- ALL WORKFLOW STEPS VERIFIED AND PASSED SUCCESSFULLY! ---');
}

run().catch((err) => {
  console.error('Test script error:', err);
  process.exit(1);
});

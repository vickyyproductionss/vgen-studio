

async function testEndpoint() {
  console.log('Sending request to /api/generate-voiceover on localhost:8000...');
  
  try {
    const res = await fetch('http://localhost:8000/api/generate-voiceover', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: 'India mein powerlifting start karne ki soch rahe ho?',
        voiceId: '7GpRXu1g6xcVlDMoklH3'
      })
    });
    
    console.log('Response Status:', res.status);
    const text = await res.text();
    console.log('Response Body:', text);
  } catch (error) {
    console.error('Error sending request:', error);
  }
}

testEndpoint();

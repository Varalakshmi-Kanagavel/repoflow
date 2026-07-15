const API_BASE = 'http://localhost:3001/v1';
const REPO_URL = 'https://github.com/octocat/Hello-World'; // Small repo for testing

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function run() {
  console.log('--- STARTING E2E TEST ---');

  // 1. Ingest Repo
  console.log(`\n1. Ingesting repo: ${REPO_URL}`);
  const ingestRes = await fetch(`${API_BASE}/repos/ingest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ githubUrl: REPO_URL }),
  });

  if (!ingestRes.ok) {
    const error = await ingestRes.text();
    console.error('Ingest failed:', error);
    process.exit(1);
  }

  const ingestData = await ingestRes.json();
  const repoId = ingestData.data.repoId;
  console.log(`Success! Repo ID: ${repoId}`);

  // 2. Poll Status
  console.log('\n2. Polling for completion...');
  let isComplete = false;
  while (!isComplete) {
    const statusRes = await fetch(`${API_BASE}/repos/${repoId}`);
    const statusData = await statusRes.json();
    const status = statusData.data.status;

    console.log(`Current status: ${status} | Chunks: ${statusData.data.totalChunks}`);

    if (status === 'COMPLETED') {
      isComplete = true;
      console.log('Ingestion completed successfully.');
    } else if (status === 'FAILED') {
      console.error('Ingestion failed!', statusData.data.statusMessage);
      process.exit(1);
    } else {
      await sleep(2000);
    }
  }

  // 3. Ask a question
  const question = 'What does the code do? What is in this repository?';
  console.log(`\n3. Asking question: "${question}"`);

  const chatRes = await fetch(`${API_BASE}/repos/${repoId}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, stream: false }), // Testing standard JSON response first
  });

  if (!chatRes.ok) {
    const error = await chatRes.text();
    console.error('Chat failed:', error);
    process.exit(1);
  }

  const chatData = await chatRes.json();
  console.log('\n--- ANSWER ---');
  console.log(chatData.data.answer);
  console.log('\n--- CITATIONS ---');
  console.log(chatData.data.citations.map((c) => c.filePath).join(', '));
  console.log(`Confidence: ${chatData.data.confidenceScore}`);

  // 4. Test Sessions
  const sessionId = chatData.data.sessionId;
  console.log(`\n4. Verifying Session persistence. Session ID: ${sessionId}`);

  await sleep(1000); // Wait for async db persist
  const historyRes = await fetch(`${API_BASE}/repos/${repoId}/sessions/${sessionId}/messages`);
  const historyData = await historyRes.json();

  if (historyData.data.length >= 2) {
    console.log('✅ Session history retrieved successfully.');
  } else {
    console.error('❌ Missing session history messages!');
    process.exit(1);
  }

  console.log('\n✅ ALL TESTS PASSED!');
}

run().catch(console.error);

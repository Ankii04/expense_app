const fs = require('fs');
const path = require('path');

async function run() {
  const baseURL = 'http://localhost:5050/api';
  console.log('Starting integration test flow...');

  // 1. Register User
  let registerToken = null;
  try {
    const regRes = await fetch(`${baseURL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test User', email: 'test@example.com', password: 'password123' })
    });
    const regData = await regRes.json();
    console.log('Register Response:', regRes.status, regData);
  } catch (err) {
    console.log('Registration skipped or failed (might already exist):', err.message);
  }

  // 2. Login User
  const loginRes = await fetch(`${baseURL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'test@example.com', password: 'password123' })
  });
  if (!loginRes.ok) {
    throw new Error('Login failed: ' + (await loginRes.text()));
  }
  const loginData = await loginRes.json();
  const token = loginData.token;
  console.log('Logged in successfully!');

  // 3. Create Group
  const groupRes = await fetch(`${baseURL}/groups`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      name: 'Trip 2026',
      members: [
        { name: 'Rohan', joined_at: new Date('2026-06-01').toISOString(), left_at: new Date('2026-06-30').toISOString() },
        { name: 'Anjali', joined_at: new Date('2026-06-10').toISOString(), left_at: null }
      ]
    })
  });
  if (!groupRes.ok) {
    throw new Error('Failed to create group: ' + (await groupRes.text()));
  }
  const group = await groupRes.json();
  const groupId = group.id;
  console.log(`Group "Trip 2026" created with ID: ${groupId}`);

  // 4. Upload CSV
  const csvPath = path.join(__dirname, 'test_expenses.csv');
  const csvBuffer = fs.readFileSync(csvPath);
  const blob = new Blob([csvBuffer], { type: 'text/csv' });

  const formData = new FormData();
  formData.append('file', blob, 'test_expenses.csv');

  const uploadRes = await fetch(`${baseURL}/groups/${groupId}/import`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    body: formData
  });

  if (!uploadRes.ok) {
    throw new Error('CSV Upload failed: ' + (await uploadRes.text()));
  }
  const importResult = await uploadRes.json();
  console.log('CSV Import successful! Report generated.');

  // Save the report as import_report.json
  const reportPath = path.join(__dirname, 'import_report.json');
  fs.writeFileSync(reportPath, JSON.stringify(importResult.import_report || importResult, null, 2));
  console.log(`Saved report to ${reportPath}`);

  // Save the report as formatted markdown import_report.md
  const mdContent = `# Spendify CSV Import Anomaly Report

This report was generated automatically by the Spendify backend when processing the uploaded CSV file.

## Import Summary
- **Filename**: \`test_expenses.csv\`
- **Group ID**: \`${groupId}\`
- **Total Rows**: ${importResult.total_rows || importResult.totalRows || 0}
- **Successfully Processed (No Errors)**: ${importResult.successful_rows || importResult.successfulRows || 0}
- **Anomalies Detected (Warnings/Duplicates)**: ${importResult.anomaly_count || importResult.anomalyCount || 0}

## Details per Row
| Row # | Description | Amount | Date | Status | Errors / Warnings | Action Taken |
|-------|-------------|--------|------|--------|-------------------|--------------|
${(importResult.import_report?.reports || []).map(r => {
  const details = [...r.errors, ...r.warnings].join('; ');
  return `| ${r.rowNumber} | ${r.data?.note || r.note} | ₹${r.data?.amountInINR || r.amount} | ${r.data?.date} | **${r.status}** | ${details || 'None'} | ${r.actionTaken} |`;
}).join('\n')}

---
Report created on: ${new Date().toLocaleString('en-IN')}
`;
  const mdPath = path.join(__dirname, 'import_report.md');
  fs.writeFileSync(mdPath, mdContent);
  console.log(`Saved markdown report to ${mdPath}`);
}

run().catch(err => {
  console.error('❌ Error during test run:', err);
});

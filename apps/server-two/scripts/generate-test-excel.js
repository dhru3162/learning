/**
 * Test Excel Generator Script
 * Generates sample Excel files for testing:
 * 1. sample-valid.xlsx       -> 20 valid users
 * 2. sample-with-errors.xlsx -> 30 records containing format errors, missing values, duplicates
 * 3. sample-1000.xlsx        -> 1,000 records to test batches of 100
 */

import ExcelJS from 'exceljs';
import * as fs from 'node:fs';
import * as path from 'node:path';

const outputDir = path.resolve(process.cwd(), 'sample-files');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// ─── 1. Valid Users Sample ──────────────────────────────────────────────────
async function generateValidSample() {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Users');

  sheet.columns = [
    { header: 'Name', key: 'name', width: 20 },
    { header: 'Email', key: 'email', width: 28 },
    { header: 'Phone', key: 'phone', width: 16 },
    { header: 'Age', key: 'age', width: 10 },
  ];

  const firstNames = ['Rahul', 'Amit', 'Priya', 'Jay', 'Sneha', 'Vikas', 'Pooja', 'Ankit', 'Neha', 'Rohan'];
  const lastNames = ['Sharma', 'Verma', 'Patel', 'Singh', 'Gupta', 'Mehta', 'Kumar', 'Joshi', 'Shah', 'Yadav'];

  for (let i = 1; i <= 25; i++) {
    const fn = firstNames[i % firstNames.length];
    const ln = lastNames[i % lastNames.length];
    sheet.addRow({
      name: `${fn} ${ln}`,
      email: `${fn.toLowerCase()}.${ln.toLowerCase()}${i}@example.com`,
      phone: `98765432${(10 + i).toString().slice(-2)}`,
      age: 20 + (i % 30),
    });
  }

  const file = path.join(outputDir, 'sample-valid.xlsx');
  await workbook.xlsx.writeFile(file);
  console.log(`✓ Created: ${file} (25 valid records)`);
}

// ─── 2. Mixed Errors Sample ────────────────────────────────────────────────
async function generateErrorsSample() {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Users');

  sheet.columns = [
    { header: 'Name', key: 'name', width: 20 },
    { header: 'Email', key: 'email', width: 28 },
    { header: 'Phone', key: 'phone', width: 16 },
    { header: 'Age', key: 'age', width: 10 },
  ];

  const records = [
    { name: 'Rahul Sharma', email: 'rahul@gmail.com', phone: '9876543210', age: 25 }, // Valid
    { name: 'Amit Verma', email: 'amit@gmail.com', phone: '9876543211', age: 28 },   // Valid
    { name: '', email: 'noname@gmail.com', phone: '9876543212', age: 24 },            // Error: Missing Name
    { name: 'Priya Joshi', email: 'invalid-email-format', phone: '9876543213', age: 22 }, // Error: Invalid Email
    { name: 'Jay Patel', email: 'jay@gmail.com', phone: '12345', age: 30 },            // Error: Phone not 10 digits
    { name: 'Sneha Shah', email: 'sneha@gmail.com', phone: '9876543214', age: 'abc' },// Error: Age not number
    { name: 'Duplicate First', email: 'dup@gmail.com', phone: '9876543215', age: 32 },// Valid
    { name: 'Duplicate Second', email: 'dup@gmail.com', phone: '9876543216', age: 35 },// Error: Duplicate email in file
    { name: 'Vikas Gupta', email: 'vikas@gmail.com', phone: '9876543217', age: -5 },  // Error: Invalid Age
    { name: 'Rohan Kumar', email: 'rohan@gmail.com', phone: '9876543218', age: 29 }, // Valid
  ];

  records.forEach((r) => sheet.addRow(r));

  const file = path.join(outputDir, 'sample-with-errors.xlsx');
  await workbook.xlsx.writeFile(file);
  console.log(`✓ Created: ${file} (10 mixed records)`);
}

// ─── 3. Large 1,000 Records Sample ─────────────────────────────────────────
async function generate1000Sample() {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Users');

  sheet.columns = [
    { header: 'Name', key: 'name', width: 20 },
    { header: 'Email', key: 'email', width: 32 },
    { header: 'Phone', key: 'phone', width: 16 },
    { header: 'Age', key: 'age', width: 10 },
  ];

  for (let i = 1; i <= 1000; i++) {
    sheet.addRow({
      name: `User Number ${i}`,
      email: `benchmark.user.${i}@importtest.com`,
      phone: `980000${i.toString().padStart(4, '0')}`,
      age: 18 + (i % 60),
    });
  }

  const file = path.join(outputDir, 'sample-1000.xlsx');
  await workbook.xlsx.writeFile(file);
  console.log(`✓ Created: ${file} (1,000 records for batch testing)`);
}

async function run() {
  await generateValidSample();
  await generateErrorsSample();
  await generate1000Sample();
  console.log('\nAll sample files generated successfully in /sample-files directory.');
}

run().catch(console.error);

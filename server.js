// Updated MyPharma backend using GPT-4 with medical coding and pdf-lib fallback

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fileUpload = require('express-fileupload');
const { PDFDocument } = require('pdf-lib');
const ExcelJS = require('exceljs');
require('dotenv').config();
const OpenAI = require('openai');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const app = express();
const port = 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(fileUpload());

// POST /chat - AI chat assistant
app.post('/chat', async (req, res) => {
  const userMessage = req.body.message;
  if (!userMessage) return res.status(400).json({ error: 'No message provided.' });

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: 'You are a helpful pharmacy assistant.' },
        { role: 'user', content: userMessage },
      ],
    });

    if (!response.choices || response.choices.length === 0) {
      return res.status(500).json({ error: 'No response from OpenAI.' });
    }

    res.json({ reply: response.choices[0].message.content });
  } catch (error) {
    console.error('OpenAI Error:', error);
    res.status(500).json({ error: 'Failed to get response from OpenAI.' });
  }
});

// POST /upload - PDF to Excel conversion using GPT-4 + medical coding
app.post('/upload', async (req, res) => {
  if (!req.files || !req.files.pdf) {
    return res.status(400).send('No PDF file uploaded');
  }

  try {
    const pdfBuffer = req.files.pdf.data;
    const pdfParse = require('pdf-parse');
    const pdfData = await pdfParse(pdfBuffer);
    const extractedText = pdfData.text;

    const prompt = `
You are a medical coder. A doctor has shared the following prescription:

"""
${extractedText}
"""

Please extract and return a structured JSON array with:
- Patient Name (if available)
- Date (if available)
- Disease
- ICD-10 Code
- Medicine
- RxNorm or ATC Code (use RxNorm if both are known)
- Dosage or Frequency

Return only valid JSON array with no explanation or markdown, like:
[
  {
    "patient": "Rajesh",
    "date": "04-Apr-2025",
    "disease": "Fever",
    "icd10": "R50.9",
    "medicine": "Paracetamol",
    "medicine_code": "N02BE01",
    "dosage": "500mg twice a day"
  }
]`;

    const chatRes = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: 'You are a helpful AI medical coder.' },
        { role: 'user', content: prompt },
      ],
    });

    let structuredData;
    const rawResponse = chatRes.choices[0].message.content.trim();
    console.log('🔍 GPT-4 raw response:', rawResponse);
    try {
      structuredData = JSON.parse(rawResponse);
    } catch (jsonError) {
      console.error('GPT-4 raw response (not JSON):', rawResponse);
      console.error('JSON Parse Error:', jsonError);
      return res.status(500).send('OpenAI did not return valid JSON.');
    }

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Medical Coding');

    sheet.columns = [
      { header: 'Patient Name', key: 'patient', width: 25 },
      { header: 'Date', key: 'date', width: 15 },
      { header: 'Disease', key: 'disease', width: 25 },
      { header: 'ICD-10 Code', key: 'icd10', width: 15 },
      { header: 'Medicine', key: 'medicine', width: 25 },
      { header: 'Medicine Code', key: 'medicine_code', width: 20 },
      { header: 'Dosage', key: 'dosage', width: 30 },
    ];

    structuredData.forEach(row => sheet.addRow(row));

    res.setHeader('Content-Disposition', 'attachment; filename="medical_coding.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

    await workbook.xlsx.write(res);
    res.end();

  } catch (err) {
    console.error('PDF Processing Error:', err);
    res.status(500).send('Failed to process PDF');
  }
});

app.listen(port, () => {
  console.log(`✅ MyPharma backend running at http://localhost:${port}`);
});

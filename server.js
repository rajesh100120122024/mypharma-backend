// server.js - Backend for MyPharmaAssistantBot (Chat + PDF to Excel)

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
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: 'You are a helpful pharmacy assistant.' },
        { role: 'user', content: userMessage },
      ],
    });

    console.log("✅ OpenAI raw response:", response);

    if (!response.choices || response.choices.length === 0) {
      return res.status(500).json({ error: 'No response from OpenAI.' });
    }

    res.json({ reply: response.choices[0].message.content });
  } catch (error) {
    console.error('OpenAI Error:', error);
    res.status(500).json({ error: 'Failed to get response from OpenAI.' });
  }
});

// POST /upload - PDF to Excel conversion
app.post('/upload', async (req, res) => {
  if (!req.files || !req.files.pdf) {
    return res.status(400).send('No PDF file uploaded');
  }

  try {
    const dataBuffer = req.files.pdf.data;
    const pdfDoc = await PDFDocument.load(dataBuffer);
    const pages = pdfDoc.getPages();
    const extractedText = pages.map(page => page.getTextContent?.()?.items?.map(item => item.str).join(' ') || '').join('');

    // Simulated extraction logic (replace with NLP or regex later)
    const diseases = ['Fever', 'Cough'];
    const medicines = ['Paracetamol', 'Cough Syrup'];

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Prescription');

    sheet.columns = [
      { header: 'Disease', key: 'disease', width: 30 },
      { header: 'Medicine', key: 'medicine', width: 30 },
    ];

    diseases.forEach((disease, i) => {
      sheet.addRow({ disease, medicine: medicines[i] || '' });
    });

    res.setHeader('Content-Disposition', 'attachment; filename="output.xlsx"');
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

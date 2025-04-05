// Updated /upload route in server.js using GPT-4 + medical coding

app.post('/upload', async (req, res) => {
    if (!req.files || !req.files.pdf) {
      return res.status(400).send('No PDF file uploaded');
    }
  
    try {
      const dataBuffer = req.files.pdf.data;
      const pdfDoc = await PDFDocument.load(dataBuffer);
      const pages = pdfDoc.getPages();
      const extractedText = (await Promise.all(
        pages.map(async (page) => {
          const textContent = await page.getTextContent();
          return textContent.items.map(item => item.str).join(' ');
        })
      )).join('\n');
  
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
  
  Format like:
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
  
      const structuredData = JSON.parse(chatRes.choices[0].message.content);
  
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
  
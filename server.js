// server.js
const express = require('express');
const fetch = require('node-fetch'); // ou use o built-in fetch do Node 18+
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/proxy', async (req, res) => {
  const url = req.query.url;
  if (!url) {
    return res.status(400).send('Falta a URL!');
  }
  try {
    const response = await fetch(url);
    const contentType = response.headers.get('content-type');
    const buffer = await response.buffer();
    // Adiciona o cabeçalho para liberar o acesso
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Content-Type', contentType);
    res.send(buffer);
  } catch (error) {
    console.error(error);
    res.status(500).send('Erro ao buscar o arquivo.');
  }
});

app.listen(PORT, () => {
  console.log(`Proxy rodando na porta ${PORT}`);
});

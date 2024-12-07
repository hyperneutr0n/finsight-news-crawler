const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
const port = 3000;

app.use(cors());

const stockCodes = [
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'TSLA', 'NVDA', 'JPM', 'JNJ', 'PG',
  '^GSPC', 'BTC-USD', 'GC=F', 'XOM', 'CVX', 'PFE', 'MRNA'
];

const processNewsPage = async (newsUrl, imgUrl) => {
  try {
    const response = await axios.get(newsUrl);
    const $ = cheerio.load(response.data);

    const convertToNanoseconds = (dateString) => {
      const date = new Date(dateString); // Parse ISO 8601 to Date object
      const milliseconds = date.getTime(); // Get timestamp in milliseconds
      return BigInt(milliseconds) * 1_000_000n; // Convert to nanoseconds
    };

    const code = $('div.name').text().trim();
    const title = $('h1.cover-title').text().trim();
    const content = $('p').map((i, el) => $(el).text().trim()).get().join(' ');
    const publisherAuthor = $('div.byline-attr-author').text().trim();
    const percentageChange = $('fin-streamer.percentChange').text().trim();
    const dateAttr = $('time.byline-attr-meta-time').attr('datetime');
    const date = dateAttr ? new Date(dateAttr) : null;
    const nanoSeconds = convertToNanoseconds(date);

    return {
      code,
      title,
      content,
      publisherAuthor,
      percentageChange,
      nanoSeconds,
      dateAttr,
      dateText: $('time.byline-attr-meta-time').text(),
      timeAgo: date ? formatDistanceToNow(date, { addSuffix: true }) : 'Unknown',
      imgUrl
    };
  } catch (error) {
    console.error('Error processing news page:', error.message);
    return null;
  }
};

app.get('/', async (req, res) => {
  try {
    let allNewsContent = {};

    await Promise.all(
      stockCodes.map(async (stockCode) => {
        const url = `https://finance.yahoo.com/quote/${stockCode}/`;
        const response = await axios.get(url);
        const $ = cheerio.load(response.data);
        const uniqueNewsUrls = new Map();

        $('div.stream-item.yf-186c5b2 a.subtle-link').each((index, element) => {
          const href = $(element).attr('href');
          const imgUrl = $(element).closest('div.stream-item').find('img.tw-bg-opacity-25').attr('src');
          console.log("image: " + imgUrl);
          if (href) {
            const fullUrl = href.startsWith('http') ? href : `https://finance.yahoo.com${href}`;
            uniqueNewsUrls.set(fullUrl, imgUrl); // Simpan fullUrl sebagai key dan imgUrl sebagai value
          }
        });
        
        const limitedNewsUrls = Array.from(uniqueNewsUrls.entries()).slice(0, 3);
        console.log(limitedNewsUrls);
        const newsContents = await Promise.all(
          limitedNewsUrls.map(async ([fullUrl, imgUrl]) => {
            console.log('Fetching URL:', fullUrl);
            return await processNewsPage(fullUrl, imgUrl);
          })
        );
        allNewsContent[stockCode] = newsContents.filter(Boolean);
      })
    );
    for (const key in allNewsContent) {
      if (Array.isArray(allNewsContent[key])) {
        // Filter out objects with empty "code"
        allNewsContent[key] = allNewsContent[key].filter(item => item.code && item.code.trim() !== '');
      }
    }
    // Convert BigInt to string for serialization
    const response = JSON.parse(
      JSON.stringify(allNewsContent, (key, value) =>
        typeof value === 'bigint' ? value.toString() : value
      )
    );
    res.json({
      message: 'Crawling and news extraction completed!',
      allNewsContent: response,
    });
  } catch (error) {
    console.error('Error during crawling:', error.message);
    res.status(500).send('An error occurred while crawling');
  }
});

// Endpoint untuk mengecek status URL
app.get('/test', async (req, res) => {
  const testUrl = req.query.url; // Ambil URL dari parameter query

  if (!testUrl) {
    return res.status(400).send('URL parameter is required');
  }

  try {
    // Mengirimkan request untuk mengecek apakah URL dapat dijangkau
    const response = await axios.get(testUrl);

    // Jika request berhasil, kembalikan status code dan data
    res.json({
      message: 'URL is reachable!',
      statusCode: response.status,
      statusText: response.statusText,
    });
  } catch (error) {
    // Jika gagal, kembalikan error
    res.status(500).json({
      message: 'Error accessing URL',
      error: error.message,
    });
  }
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
const dotenv = require("dotenv");
dotenv.config();
const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");
<<<<<<< HEAD
const moment = require('moment');
const got = require('got');
const fetch = require('node-fetch')
=======
const moment = require("moment");
>>>>>>> b15ba939ad2008eed75c5dd35584fc6f5d805441
const { formatDistanceToNow } = require("date-fns");
const { auth, db } = require("./firebase");
const {
  doc,
  setDoc,
  collection,
  addDoc,
  getDoc,
  getDocs,
} = require("firebase/firestore");
const app = express();
const port = 3000;

const stockCodes = ["^GSPC", "BTC-USD", "AMZN", "GOOGL"];

const processNewsPage = async (newsUrl, imgUrl, code) => {
  try {
    const response = await got(newsUrl); // Ganti axios dengan fetch
    const $ = cheerio.load(response.body);

    const convertToNanoseconds = (dateString) => {
      const date = new Date(dateString); // Parse ISO 8601 to Date object
      const milliseconds = date.getTime(); // Get timestamp in milliseconds
      return BigInt(milliseconds) * 1_000_000n; // Convert to nanoseconds
    };

    const relatedCode = $("div.name").text().trim() || null;
    const title = $("h1.cover-title").text().trim() || null;
    const content =
      $("p")
        .map((i, el) => $(el).text().trim())
        .get()
        .join(" ") || null;

    const publisherAuthor = $("div.byline-attr-author").text().trim() || null;
    const percentageChange =
      $("fin-streamer.percentChange").text().trim() || null;
    const dateAttr = $("time.byline-attr-meta-time").attr("datetime") || null;
    const date = dateAttr ? new Date(dateAttr) : null;
    const nanoSeconds = date ? convertToNanoseconds(date) : null;
    return {
      createdAt: moment().format("YYYYMMDD"),
      code,
      relatedCode,
      title,
      content,
      publisherAuthor,
      percentageChange,
      nanoSeconds,
      dateAttr,
      dateText: $("time.byline-attr-meta-time").text() || null,
      timeAgo: date
        ? formatDistanceToNow(date, { addSuffix: true })
        : "Unknown",
      imgUrl: imgUrl || null,
    };
  } catch (error) {
    // Log the error for debugging purposes
    console.error("Error processing news page:", error.message);

    // Return a default object with null or fallback values
    return {
      createdAt: null,
      code: null,
      relatedCode: null,
      title: null,
      content: null,
      publisherAuthor: null,
      percentageChange: null,
      nanoSeconds: null,
      dateAttr: null,
      dateText: null,
      timeAgo: "Unknown",
      imgUrl: imgUrl || null,
    };
  }
};

app.get("/", async (req, res) => {
  try {
    let allNewsContent = {};

    await Promise.all(
      stockCodes.map(async (stockCode) => {
        const url = `https://finance.yahoo.com/quote/${stockCode}/`;
        const response = await got(url); // Ganti axios dengan fetch
        const $ = cheerio.load(response.body);
        const uniqueNewsUrls = new Map();

        $("div.stream-item.yf-186c5b2 a.subtle-link").each((index, element) => {
          const href = $(element).attr("href");
          const imgUrl = $(element)
            .closest("div.stream-item")
            .find("img.tw-bg-opacity-25")
            .attr("src");
          if (href) {
            const fullUrl = href.startsWith("http")
              ? href
              : `https://finance.yahoo.com${href}`;
            uniqueNewsUrls.set(fullUrl, imgUrl);
          }
        });

        const limitedNewsUrls = Array.from(uniqueNewsUrls.entries()).slice(
          0,
          1
        );
        console.log(limitedNewsUrls);
        const newsContents = await Promise.all(
          limitedNewsUrls.map(async ([fullUrl, imgUrl]) => {
            console.log("Fetching URL:", fullUrl);
            return await processNewsPage(fullUrl, imgUrl, stockCode);
          })
        );

        allNewsContent[stockCode] = newsContents.filter(Boolean);
      })
    );

    for (const key in allNewsContent) {
      if (Array.isArray(allNewsContent[key])) {
        allNewsContent[key] = allNewsContent[key].filter(
          (item) => item.code && item.code.trim() !== ""
        );
      }
    }

    const response = JSON.parse(
      JSON.stringify(allNewsContent, (key, value) =>
        typeof value === "bigint" ? value.toString() : value
      )
    );
    console.log(response);

    const formattedNews = [];
    for (const key in response) {
      if (Array.isArray(response[key])) {
        formattedNews.push(
          ...response[key]
            .map((item) => {
              if (item.code) {
                return {
                  createdAt: item.createdAt,
                  code: item.code,
                  title: item.title,
                  content: item.content,
                  publisherAuthor: item.publisherAuthor,
                  dateText: item.dateText,
                  imgUrl: item.imgUrl,
                };
              }
              return null;
            })
            .filter(Boolean) // Filter out any null values
        );
      }
    }

    // Insert each formatted news item into Firestore
    await Promise.all(
      formattedNews.map(async (newsItem) => {
        if (newsItem) {
          await addDoc(collection(db, "news"), newsItem); // Each newsItem is an object
        }
      })
    );

    res.json({
      message: "Crawling and news extraction completed!",
      allNewsContent: formattedNews,
    });
  } catch (error) {
    console.error("Error during crawling:", error.message);
    res.status(500).send("An error occurred while crawling");
  }
});

// Endpoint untuk mengecek status URL
app.get("/test", async (req, res) => {
  try {
    const url = `https://finance.yahoo.com/quote/${encodedSymbol}`;  // Gunakan simbol yang sudah di-encode

    const response = await got(url);
    if (response) res.status(200).send("Success");
  } catch (error) {
    console.error("ga nemu");
    return null;
  }
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
<<<<<<< HEAD
});
=======
});
>>>>>>> b15ba939ad2008eed75c5dd35584fc6f5d805441

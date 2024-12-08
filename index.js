const dotenv = require("dotenv");
dotenv.config();
const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");
const puppeteer = require("puppeteer"); // Tambahkan Puppeteer
const { formatDistanceToNow } = require("date-fns");
const { Builder, By, until } = require("selenium-webdriver");
const chrome = require("selenium-webdriver/chrome");
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

const stockCodes = ["^GSPC"];

const processNewsPage = async (newsUrl, imgUrl) => {
  try {
    const response = await axios.get(newsUrl);
    const $ = cheerio.load(response.data);

    const convertToNanoseconds = (dateString) => {
      const date = new Date(dateString); // Parse ISO 8601 to Date object
      const milliseconds = date.getTime(); // Get timestamp in milliseconds
      return BigInt(milliseconds) * 1_000_000n; // Convert to nanoseconds
    };

    const code = $("div.name").text().trim() || null;
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
    console.log("success");
    return {
      code,
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
      code: null,
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
        const response = await axios.get(url);
        const $ = cheerio.load(response.data);
        const uniqueNewsUrls = new Map();

        $("div.stream-item.yf-186c5b2 a.subtle-link").each((index, element) => {
          const href = $(element).attr("href");
          const imgUrl = $(element)
            .closest("div.stream-item")
            .find("img.tw-bg-opacity-25")
            .attr("src");
          //console.log("image: " + imgUrl);
          if (href) {
            const fullUrl = href.startsWith("http")
              ? href
              : `https://finance.yahoo.com${href}`;
            uniqueNewsUrls.set(fullUrl, imgUrl); // Simpan fullUrl sebagai key dan imgUrl sebagai value
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
            return await processNewsPage(fullUrl, imgUrl);
          })
        );

        allNewsContent[stockCode] = newsContents.filter(Boolean);
      })
    );
    console.log("SUCCESSS");
    for (const key in allNewsContent) {
      if (Array.isArray(allNewsContent[key])) {
        // Filter out objects with empty "code"
        allNewsContent[key] = allNewsContent[key].filter(
          (item) => item.code && item.code.trim() !== ""
        );
      }
    }
    // Convert BigInt to string for serialization
    const response = JSON.parse(
      JSON.stringify(allNewsContent, (key, value) =>
        typeof value === "bigint" ? value.toString() : value
      )
    );

    


    res.json({
      message: "Crawling and news extraction completed!",
      allNewsContent: response,
    });
  } catch (error) {
    console.error("Error during crawling:", error.message);
    res.status(500).send("An error occurred while crawling");
  }
});

// Endpoint untuk mengecek status URL
app.get("/test", async (req, res) => {
  try {
    const url = encodeURI("https://finance.yahoo.com/quote/BTC-USD/");
    const response = await axios.get(url);
    if (response) res.status(200).send("Success");
  } catch (error) {
    console.error("ga nemu");
    return null;
  }
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});

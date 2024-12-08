const dotenv = require("dotenv");
dotenv.config();
const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");
const moment = require('moment');
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

const stockCodes = ["^GSPC"];

const processNewsPage = async (newsUrl, imgUrl, code) => {
  try {
    const response = await axios.get(newsUrl);
    const $ = cheerio.load(response.data);

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
            return await processNewsPage(fullUrl, imgUrl, stockCode);
          })
        );

        allNewsContent[stockCode] = newsContents.filter(Boolean);
      })
    );

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
    console.log(response);
    const formattedNews = [];
    for (const key in response) {
      if (Array.isArray(response[key])) {
        formattedNews.push(response[key].map(item => {
          if (item.code) {
            return {
              createdAt: item.createdAt,
              code: item.code,
              relatedCode: item.relatedCode,
              title: item.title,
              content: item.content,
              publisherAuthor: item.publisherAuthor,
              percentageChange: item.percentageChange,
              nanoSeconds: item.nanoSeconds,
              dateAttr: item.dateAttr,
              dateText: item.dateText,
              timeAgo: item.timeAgo,
              imgUrl: item.imgUrl,
            };
          }
          return null;
        }).filter(Boolean));
        // Hapus nilai null
      }
    }

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

[
  {
    "code": "^GSPC",
    "title": "1 Stock to Buy, 1 Stock to Sell This Week: Oracle, AutoZone",
    "content": "We are experiencing some temporary issues. The market data on this page is currently delayed. Please bear with us as we address this and restore your personalized lists. • CPI inflation, producer prices, and the last batch of earnings will be in focus this week. • Oracle’s accelerating cloud business and bullish market sentiment make it a top pick to buy this week. • AutoZone faces near-term challenges that warrant caution, making it a stock to sell this week. • Looking for more actionable trade ideas? Subscribe here for 55% off InvestingPro as part of our Cyber Week Extended sale! U.S. stocks closed higher on Friday, as the S&P 500 and Nasdaq Composite both ended at new records after the monthly jobs report kept the door open for another rate cut from the Federal Reserve later this month. For the week, the Nasdaq jumped 3.3% and the S&P 500 rose 1% to notch their third straight positive week. The Dow Jones Industrial Average fell 0.6%, despite hitting a fresh all-time peak on Wednesday. Source: Investing.com The week ahead is expected to be another eventful one as investors continue to gauge the outlook for the economy and interest rates. As of Sunday morning, investors see an 89% chance of the Fed cutting rates by 25 basis points at its December 18 meeting. On the economic calendar, most important will be Wednesday’s U.S. consumer price inflation report for November, which is forecast to show headline annual CPI rising 2.7% year-over-year, compared to October’s 2.6% increase. The CPI data will be accompanied by the release of the latest figures on producer prices, which will help fill out the inflation picture. Source: Investing.com Elsewhere, on the earnings docket, there are just a handful of corporate results due, including Broadcom (NASDAQ:AVGO), Oracle (NYSE:ORCL), Adobe (NASDAQ:ADBE), MongoDB (NASDAQ:MDB), Costco (NASDAQ:COST), GameStop (NYSE:GME), and Macy’s (NYSE:M) as Wall Street’s reporting season draws to a close. Regardless of which direction the market goes, below I highlight one stock likely to be in demand and another which could see fresh downside. Remember though, my timeframe is just for the week ahead, Monday, December 9 - Friday, December 13. Oracle stands out as a top buy this week, with its highly anticipated earnings report set to be a major catalyst for the stock. The cloud and software leader will likely deliver another quarter of upbeat top-and bottom-line growth and provide solid guidance thanks to broad strength in its cloud infrastructure business. Oracle is scheduled to release its fiscal second quarter update after the closing bell on Monday at 4:05PM EST. A call with CEO Safra Catz as well as Chairman and Chief Technology Officer Larry Ellison is set for 5:00PM ET. Market participants expect a sizable swing in ORCL stock after the print drops, according to the options market, with a possible implied move of +/-8.7% in either direction. Analyst sentiment is optimistic, with 10 upward revisions to Oracle’s earnings estimates in the past 90 days, further boosting confidence. Source: InvestingPro Wall Street sees the Austin, Texas-based database giant earning $1.48 per share for the November-ending quarter, rising 10.4% from the year-ago period. Meanwhile, revenue is projected to increase 9.3% annually to $14.1 billion. The results would mark the second straight quarter of accelerating top-line growth, supported by increasing AI-driven demand for Oracle’s database solutions and cloud infrastructure services. Oracle’s earnings have historically caused notable stock price swings, with shares surging 10% following its last earnings release in September. Data from InvestingPro suggests a favorable trend, with the cloud company gapping up in price after the last three earnings reports. ORCL stock ended Friday’s session at $191.69, just below its November 21 record high of $196.04. With a market cap of $531.2 billion, Oracle is one of the most valuable database software and cloud computing companies in the world. Source: Investing.com The stock has surged over 80% year-to-date, its best annual performance since 1999. It is worth mentioning that Oracle has an above-average InvestingPro Financial Health Score of 2.8/5.0, highlighting its solid earnings prospects, and a robust profitability outlook. Furthermore, it should be noted that the tech company has raised its annual dividend payout for 11 consecutive years. Be sure to check out InvestingPro to stay in sync with the market trend and what it means for your trading. Subscribe now and get 55% off and position your portfolio one step ahead of everyone else! In contrast, AutoZone (NYSE:AZO) faces mounting challenges. The auto-parts retailer is set to release its fiscal Q1 earnings report on Tuesday morning at 6:55AM ET, and analysts expect muted results. According to the options market, traders are pricing in a swing of +/-5.7% in either direction for AZO stock following the print. Underscoring several challenges facing AutoZone, all 14 analysts surveyed by InvestingPro cut their profit estimates ahead of the report to reflect a 7% decline from their initial expectations. Source: InvestingPro Wall Street projects earnings of $33.72 per share, marking a modest 3.6% increase from $32.55 a year earlier. If that is confirmed, it would mark the second consecutive quarter of low single-digit earnings growth. Meanwhile, revenue is anticipated to grow marginally by 2.4% to $4.3 billion, highlighting cautious consumer spending and rising competition. Additionally, looming headwinds which threaten to pressure AutoZone’s margins are dampening sentiment amid worries that the incoming Trump administration will impose high tariffs as the company imports goods and parts from China. As such, AutoZone's forward guidance will likely underwhelm investors due to the current macroeconomic environment. AZO stock closed at a fresh all-time high of $3,309.44 on Friday, eclipsing the previous record of $3,256 reached on March 22. At current valuations, AutoZone has a market cap of $56 billion, making it the second largest auto-parts store chain in the country, behind O’Reilly Automotive. Source: Investing.com Shares have gained 28% in the year-to-date. It should be noted that its valuation remains stretched compared to peers, and the near-term pressures may limit upside potential. The average Fair Value for AZO stands at $2,973.63, a potential downside of -10.1% from current levels. Whether you're a novice investor or a seasoned trader, leveraging InvestingPro can unlock a world of investment opportunities while minimizing risks amid the challenging market backdrop. Subscribe now to get 55% off all Pro plans with our Cyber Week Extended offer and instantly unlock access to several market-beating features, including: • ProPicks AI: AI-selected stock winners with proven track record. • InvestingPro Fair Value: Instantly find out if a stock is underpriced or overvalued. • Advanced Stock Screener: Search for the best stocks based on hundreds of selected filters, and criteria. • Top Ideas: See what stocks billionaire investors such as Warren Buffett, Michael Burry, and George Soros are buying. Disclosure: At the time of writing, I am long on the S&P 500, and the Nasdaq 100 via the SPDR® S&P 500 ETF, and the Invesco QQQ Trust ETF. I am also long on the Technology Select Sector SPDR ETF (NYSE:XLK). I regularly rebalance my portfolio of individual stocks and ETFs based on ongoing risk assessment of both the macroeconomic environment and companies' financials. The views discussed in this article are solely the opinion of the author and should not be taken as investment advice. Follow Jesse Cohen on X/Twitter @JesseCohenInv for more stock market analysis and insight. Related Articles 1 Stock to Buy, 1 Stock to Sell This Week: Oracle, AutoZone Speculative Retail Bets Are Pushing Leverage to Dangerous Levels 3 High-Risk High-Reward Stocks to Buy for 2025 Sign in to access your portfolio",
    "publisherAuthor": "Jesse Cohen"
  },
  {
    "code": "^GSPC",
    "title": "1 Stock to Buy, 1 Stock to Sell This Week: Oracle, AutoZone",
    "content": "We are experiencing some temporary issues. The market data on this page is currently delayed. Please bear with us as we address this and restore your personalized lists. • CPI inflation, producer prices, and the last batch of earnings will be in focus this week. • Oracle’s accelerating cloud business and bullish market sentiment make it a top pick to buy this week. • AutoZone faces near-term challenges that warrant caution, making it a stock to sell this week. • Looking for more actionable trade ideas? Subscribe here for 55% off InvestingPro as part of our Cyber Week Extended sale! U.S. stocks closed higher on Friday, as the S&P 500 and Nasdaq Composite both ended at new records after the monthly jobs report kept the door open for another rate cut from the Federal Reserve later this month. For the week, the Nasdaq jumped 3.3% and the S&P 500 rose 1% to notch their third straight positive week. The Dow Jones Industrial Average fell 0.6%, despite hitting a fresh all-time peak on Wednesday. Source: Investing.com The week ahead is expected to be another eventful one as investors continue to gauge the outlook for the economy and interest rates. As of Sunday morning, investors see an 89% chance of the Fed cutting rates by 25 basis points at its December 18 meeting. On the economic calendar, most important will be Wednesday’s U.S. consumer price inflation report for November, which is forecast to show headline annual CPI rising 2.7% year-over-year, compared to October’s 2.6% increase. The CPI data will be accompanied by the release of the latest figures on producer prices, which will help fill out the inflation picture. Source: Investing.com Elsewhere, on the earnings docket, there are just a handful of corporate results due, including Broadcom (NASDAQ:AVGO), Oracle (NYSE:ORCL), Adobe (NASDAQ:ADBE), MongoDB (NASDAQ:MDB), Costco (NASDAQ:COST), GameStop (NYSE:GME), and Macy’s (NYSE:M) as Wall Street’s reporting season draws to a close. Regardless of which direction the market goes, below I highlight one stock likely to be in demand and another which could see fresh downside. Remember though, my timeframe is just for the week ahead, Monday, December 9 - Friday, December 13. Oracle stands out as a top buy this week, with its highly anticipated earnings report set to be a major catalyst for the stock. The cloud and software leader will likely deliver another quarter of upbeat top-and bottom-line growth and provide solid guidance thanks to broad strength in its cloud infrastructure business. Oracle is scheduled to release its fiscal second quarter update after the closing bell on Monday at 4:05PM EST. A call with CEO Safra Catz as well as Chairman and Chief Technology Officer Larry Ellison is set for 5:00PM ET. Market participants expect a sizable swing in ORCL stock after the print drops, according to the options market, with a possible implied move of +/-8.7% in either direction. Analyst sentiment is optimistic, with 10 upward revisions to Oracle’s earnings estimates in the past 90 days, further boosting confidence. Source: InvestingPro Wall Street sees the Austin, Texas-based database giant earning $1.48 per share for the November-ending quarter, rising 10.4% from the year-ago period. Meanwhile, revenue is projected to increase 9.3% annually to $14.1 billion. The results would mark the second straight quarter of accelerating top-line growth, supported by increasing AI-driven demand for Oracle’s database solutions and cloud infrastructure services. Oracle’s earnings have historically caused notable stock price swings, with shares surging 10% following its last earnings release in September. Data from InvestingPro suggests a favorable trend, with the cloud company gapping up in price after the last three earnings reports. ORCL stock ended Friday’s session at $191.69, just below its November 21 record high of $196.04. With a market cap of $531.2 billion, Oracle is one of the most valuable database software and cloud computing companies in the world. Source: Investing.com The stock has surged over 80% year-to-date, its best annual performance since 1999. It is worth mentioning that Oracle has an above-average InvestingPro Financial Health Score of 2.8/5.0, highlighting its solid earnings prospects, and a robust profitability outlook. Furthermore, it should be noted that the tech company has raised its annual dividend payout for 11 consecutive years. Be sure to check out InvestingPro to stay in sync with the market trend and what it means for your trading. Subscribe now and get 55% off and position your portfolio one step ahead of everyone else! In contrast, AutoZone (NYSE:AZO) faces mounting challenges. The auto-parts retailer is set to release its fiscal Q1 earnings report on Tuesday morning at 6:55AM ET, and analysts expect muted results. According to the options market, traders are pricing in a swing of +/-5.7% in either direction for AZO stock following the print. Underscoring several challenges facing AutoZone, all 14 analysts surveyed by InvestingPro cut their profit estimates ahead of the report to reflect a 7% decline from their initial expectations. Source: InvestingPro Wall Street projects earnings of $33.72 per share, marking a modest 3.6% increase from $32.55 a year earlier. If that is confirmed, it would mark the second consecutive quarter of low single-digit earnings growth. Meanwhile, revenue is anticipated to grow marginally by 2.4% to $4.3 billion, highlighting cautious consumer spending and rising competition. Additionally, looming headwinds which threaten to pressure AutoZone’s margins are dampening sentiment amid worries that the incoming Trump administration will impose high tariffs as the company imports goods and parts from China. As such, AutoZone's forward guidance will likely underwhelm investors due to the current macroeconomic environment. AZO stock closed at a fresh all-time high of $3,309.44 on Friday, eclipsing the previous record of $3,256 reached on March 22. At current valuations, AutoZone has a market cap of $56 billion, making it the second largest auto-parts store chain in the country, behind O’Reilly Automotive. Source: Investing.com Shares have gained 28% in the year-to-date. It should be noted that its valuation remains stretched compared to peers, and the near-term pressures may limit upside potential. The average Fair Value for AZO stands at $2,973.63, a potential downside of -10.1% from current levels. Whether you're a novice investor or a seasoned trader, leveraging InvestingPro can unlock a world of investment opportunities while minimizing risks amid the challenging market backdrop. Subscribe now to get 55% off all Pro plans with our Cyber Week Extended offer and instantly unlock access to several market-beating features, including: • ProPicks AI: AI-selected stock winners with proven track record. • InvestingPro Fair Value: Instantly find out if a stock is underpriced or overvalued. • Advanced Stock Screener: Search for the best stocks based on hundreds of selected filters, and criteria. • Top Ideas: See what stocks billionaire investors such as Warren Buffett, Michael Burry, and George Soros are buying. Disclosure: At the time of writing, I am long on the S&P 500, and the Nasdaq 100 via the SPDR® S&P 500 ETF, and the Invesco QQQ Trust ETF. I am also long on the Technology Select Sector SPDR ETF (NYSE:XLK). I regularly rebalance my portfolio of individual stocks and ETFs based on ongoing risk assessment of both the macroeconomic environment and companies' financials. The views discussed in this article are solely the opinion of the author and should not be taken as investment advice. Follow Jesse Cohen on X/Twitter @JesseCohenInv for more stock market analysis and insight. Related Articles 1 Stock to Buy, 1 Stock to Sell This Week: Oracle, AutoZone Speculative Retail Bets Are Pushing Leverage to Dangerous Levels 3 High-Risk High-Reward Stocks to Buy for 2025 Sign in to access your portfolio",
    "publisherAuthor": "Jesse Cohen"
  },

]
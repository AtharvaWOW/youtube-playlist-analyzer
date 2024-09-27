import { NextRequest, NextResponse } from "next/server"; // Importing necessary modules from Next.js for handling server requests and responses.
import { PlaywrightCrawler, Dataset } from "crawlee"; // Importing PlaywrightCrawler and Dataset from Crawlee to perform web scraping.
import { v4 as uuidv4 } from "uuid"; // we import this to create unique identifiers for each scraping session

interface VideoData {
  title: string;
  views: number;
  thumbnail: string;
}

interface PlaylistData {
  videoList: VideoData[];
  graphData: { name: string; views: number }[];
}

// The main POST function that handles scraping YouTube playlist data when an API call is made.
export async function POST(request: NextRequest) {
  // here we extract the playlist url from the request body
  const { playlistUrl } = await request.json();

  // here we are checking if playlist url is provided if not we return a 400 response with the error message
  if (!playlistUrl) {
    return NextResponse.json(
      { error: "Playlist URL is required" },
      { status: 400 }
    );
  }

  // Extract the playlist ID from the URL using URLSearchParams.
  const playlistId = new URL(playlistUrl).searchParams.get("list");
  if (!playlistId) {
    // Return a 400 response if the playlist ID is invalid or not found in the URL.
    return NextResponse.json(
      { error: "Invalid playlist URL" },
      { status: 400 }
    );
  }

  // here we generate a unique identifier for the scraping mission
  const uuid = uuidv4();
  // we open a dataset for each new scraping session
  const dataset = await Dataset.open(`playlist-${uuid}`);

  // here we initialize the crawler so that it will scrape youtube playlist 
  const crawler = new PlaywrightCrawler({
    maxRequestsPerCrawl: 50, // maximum requests that we want to make 
    async requestHandler({ request, page, log }) {
      // log the current url we are scraping 
      log.info(`Processing ${request.url}...`);

      // wait for the youtube thumbnail to load on the screen
      await page.waitForSelector("#contents ytd-playlist-video-renderer", {
        timeout: 30000, // we move on after 30 seconds 
      });

      // the playlist can be long and not on the screen so we scroll till the bottom to get all the content
      await page.evaluate(async () => {
        while (true) {
          const oldHeight = document.body.scrollHeight;
          window.scrollTo(0, document.body.scrollHeight);
          await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait 2 seconds between scrolls.
          if (document.body.scrollHeight === oldHeight) break; // Stop when no more content is loaded.
        }
      });

      // extract the video title and thumbnail from the playlist
      const videos: VideoData[] = await page.$$eval(
        "#contents ytd-playlist-video-renderer",
        (elements) => {
          return elements.map((el) => {
            const title =
              el.querySelector("#video-title")?.textContent?.trim() || "";
            const viewsText =
              el.querySelector("#video-info span")?.textContent?.trim() || "";
            const thumbnail = el.querySelector("img")?.src || "";

            // Extract the view count from the views text (e.g., 1.5M, 200K, etc.)
            const viewsMatch = viewsText.match(/^([\d,.]+[KMB]?)\s*views?$/i);
            let views = 0;
            if (viewsMatch) {
              const viewString = viewsMatch[1].toUpperCase().replace(/,/g, "");
              if (viewString.endsWith("K"))
                views = parseFloat(viewString) * 1000;
              else if (viewString.endsWith("M"))
                views = parseFloat(viewString) * 1000000;
              else if (viewString.endsWith("B"))
                views = parseFloat(viewString) * 1000000000;
              else views = parseInt(viewString);
            }

            // we return the title thumbnail and the views
            return { title, views, thumbnail };
          });
        }
      );

      log.info(`Found ${videos.length} videos in the playlist`);

      // also save it on the dataset
      await dataset.pushData({ videos });
    },

    // Handle any requests that fail during crawling.
    failedRequestHandler({ request, log }) {
      log.error(`Request ${request.url} failed too many times.`);
    },
  });

  try {
    // Run the crawler with the playlist URL and a unique key to bypass cache issues.
    await crawler.run([
      { url: playlistUrl, uniqueKey: `${playlistUrl}:${uuid}` },
    ]);

    // Get the scraped data from the dataset.
    const results = await dataset.getData();
    const videos = (results.items[0]?.videos as VideoData[]) || [];

    // Prepare graph data for the response.
    const graphData = videos.map((video, index) => ({
      name: `Video ${index + 1}`,
      views: video.views,
    }));

    // Combine the video list and graph data into the final playlist data.
    const playlistData: PlaylistData = {
      videoList: videos,
      graphData: graphData,
    };

    // Drop (delete) the dataset after the data has been used.
    await dataset.drop();

    // Return the playlist data as a JSON response.
    return NextResponse.json(playlistData);
  } catch (error) {
    console.error("Crawling failed:", error);

    // Ensure the dataset is dropped even if an error occurs.
    await dataset.drop();
    return NextResponse.json(
      { error: "An error occurred while scraping the playlist" },
      { status: 500 }
    );
  }
}

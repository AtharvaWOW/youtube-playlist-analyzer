"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button"; // Importing a button component
import { Input } from "@/components/ui/input"; // Importing an input field component
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"; // Importing Card components for UI layout
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"; // Importing components from Recharts for data visualization

// Interface to define the structure of video data received from the API
interface VideoData {
  title: string;
  views: number;
  thumbnail: string;
}

// Interface to define the structure of data for the graph
interface GraphData {
  name: string;
  views: number;
}

// Home component (main page of the YouTube Playlist Analyzer)
export default function Home() {
  // State to store the YouTube playlist URL entered by the user
  const [playlistUrl, setPlaylistUrl] = useState("");
  
  // State to store the video data fetched from the API
  const [videoData, setVideoData] = useState<VideoData[]>([]);
  
  // State to store the graph data (view counts for each video)
  const [graphData, setGraphData] = useState<GraphData[]>([]);
  
  // State to handle loading status while fetching data
  const [isLoading, setIsLoading] = useState(false);

  // Function to handle form submission and API request
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); // Prevents the default form submission behavior
    setIsLoading(true); // Set loading to true when fetching starts

    try {
      // Making a POST request to the backend API to scrape playlist data
      const response = await fetch("/api/scrape-playlist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ playlistUrl }), // Sending the playlist URL in the request body
      });

      // If the request fails, throw an error
      if (!response.ok) {
        throw new Error("Failed to fetch playlist data");
      }

      // Parsing the response JSON and updating the state with video and graph data
      // Convert response to json 
      const data = await response.json();
      setVideoData(data.videoList); // storing the video list 
      setGraphData(data.graphData); // storing the graph data
    } catch (error) {
      console.error("Error:", error); // Logging any errors that occur during the fetch
    } finally {
      setIsLoading(false); // loading becomes false when the fetch is doen
    }
  };

  // this is a helper function to format the view count for eg more than 10,000,000 views will show 10 M
  // or 10,000 as 10 k
  const formatViews = (views: number) => {
    if (views >= 1000000) {
      return `${(views / 1000000).toFixed(1)}M`; // Converts to millions
    } else if (views >= 1000) {
      return `${(views / 1000).toFixed(1)}K`; // Converts to thousands
    } else {
      return views.toString(); // Returns the view count as-is
    }
  };

  // this is a javascript function to render the ui 
  return (
    <div className="container mx-auto p-4">
      {/* now we are writing the card for the title details and url link*/}
      <Card>
        <CardHeader>
          <CardTitle>YouTube Playlist Analyzer</CardTitle> {/* Title */}
          <CardDescription>
            Enter a YouTube playlist URL to analyze its videos {/* Form description */}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* form where we will take input of url */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="url" // Input type is URL
              placeholder="Enter YouTube playlist URL" // Placeholder text for input
              value={playlistUrl} // Value from the state
              onChange={(e) => setPlaylistUrl(e.target.value)} // here we update the playlist url
              required // Mark input as required
            />
            <Button type="submit" disabled={isLoading}> {/* Button for form submission */}
              {isLoading ? "Analyzing..." : "Analyze Playlist"} {/* Conditional text */}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* if the video data is available then we render graph */}
      {videoData.length > 0 && (
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Card for displaying the list of videos */}
          <Card>
            <CardHeader>
              <CardTitle>Video List</CardTitle> {/* Title */}
            </CardHeader>
            <CardContent>
              // this has the list of videos 
              <ul className="space-y-4">
                {/* Looping through video data to render each video's details */}
                {videoData.map((video, index) => (
                  <li key={index} className="flex items-start space-x-4">
                    {/* Index of the video */}
                    <span className="font-bold text-lg min-w-[24px]">
                      {index + 1}. {/* List number */}
                    </span>
                    {/* Thumbnail image */}
                    <img
                      src={video.thumbnail} // Video thumbnail
                      alt={video.title} // Alt text for image
                      className="w-24 h-auto" // Image styling
                    />
                    <div>
                      <h3 className="font-semibold">{video.title}</h3> {/* Video title */}
                      <p className="text-sm text-gray-600">
                        {formatViews(video.views)} views {/* Formatted view count */}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* here is the main part where we depict the line graph for number of views */}
          <Card>
            <CardHeader>
              <CardTitle>View Count Graph</CardTitle> {/* Title */}
            </CardHeader>
            <CardContent>
              {/* we are calling it a responsive container for the line graph*/}
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={graphData}> {/* Line chart with graph data */}
                  <CartesianGrid strokeDasharray="3 3" /> {/* Grid lines */}
                  <XAxis dataKey="name" /> {/* X-axis representing video names */}
                  <YAxis /> {/* Y-axis representing view counts */}
                  <Tooltip /> {/* we render the tooltip while hovering on the graph */}
                  <Legend /> {/* Legend for the chart */}
                  <Line
                    type="monotone"
                    dataKey="views" // Line for the 'views' data
                    stroke="#8884d8" // Line color
                    activeDot={{ r: 8 }} // Active dot styling
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

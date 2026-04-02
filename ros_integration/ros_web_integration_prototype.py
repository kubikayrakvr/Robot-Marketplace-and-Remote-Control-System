from fastapi import FastAPI
from fastapi.responses import HTMLResponse
import uvicorn

app = FastAPI()

# The complete HTML frontend, embedded as a string
html_content = """
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ROS 2 + FastAPI Dashboard</title>
    
    <script src="https://cdn.jsdelivr.net/npm/eventemitter2@6.4.9/lib/eventemitter2.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/roslib@1/build/roslib.min.js"></script>

    <style>
        body { font-family: Arial, sans-serif; margin: 20px auto; max-width: 800px; padding: 0 15px; }
        .status { padding: 8px 15px; border-radius: 5px; font-weight: bold; display: inline-block; margin-bottom: 10px;}
        .connected { background-color: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
        .disconnected { background-color: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
        .warning { background-color: #fff3cd; color: #856404; border: 1px solid #ffeeba; }
        button { padding: 12px 24px; font-size: 16px; cursor: pointer; background-color: #007bff; color: white; border: none; border-radius: 5px; }
        button:hover { background-color: #0056b3; }
        .video-container { margin-top: 30px; padding: 20px; background-color: #f8f9fa; border-radius: 8px; }
        .dashboard-panel { margin-bottom: 20px; padding: 20px; background-color: #f8f9fa; border-radius: 8px; }
        img { max-width: 100%; height: auto; border: 3px solid #333; border-radius: 8px; background-color: #e9ecef; min-height: 200px; display: block; margin-top: 15px;}
        .metric { font-family: monospace; font-size: 1.2em; }
    </style>
</head>
<body>
    <h1>🤖 ROS 2 Web Dashboard</h1>
    
    <div class="dashboard-panel">
        <div>
            <span>ROSBridge Status: </span>
            <span id="status" class="status disconnected">Disconnected</span>
        </div>
        <div>
            <span>Connection Speed: </span>
            <span id="latency-display" class="status warning">Waiting for ping...</span>
        </div>
    </div>
    
    <div class="dashboard-panel">
        <h3>Test Communications</h3>
        <button onclick="publishMessage()">Send '/chatter' Message</button>
        <p id="action-log" style="color: #666; font-style: italic; margin-top: 15px;">Waiting to send message...</p>
    </div>

    <div class="video-container">
        <h3>Live Camera Feed (/camera/image_raw)</h3>
        <img id="video-stream" alt="Waiting for video stream (Is web_video_server running?)..." />
    </div>

    <script>
        // 1. Get the IP address dynamically
        var robot_ip = window.location.hostname;
        console.log("Hosting IP detected as: " + robot_ip);

        // 2. Set the video stream URL dynamically
        var videoFeed = document.getElementById("video-stream");
        videoFeed.src = "http://" + robot_ip + ":8080/stream?topic=/camera/image_raw";

        // 3. Connect to the ROSBridge WebSocket
        var ros = new ROSLIB.Ros({
            url : 'ws://' + robot_ip + ':9090'
        });

        var statusSpan = document.getElementById("status");

        ros.on('connection', function() {
            statusSpan.innerHTML = "Connected to ROS 2!";
            statusSpan.className = "status connected";
            console.log('Connected to websocket server.');
        });

        ros.on('error', function(error) {
            statusSpan.innerHTML = "Error Connecting";
            statusSpan.className = "status disconnected";
            console.log('Error connecting to websocket server: ', error);
        });

        ros.on('close', function() {
            statusSpan.innerHTML = "Connection Closed";
            statusSpan.className = "status disconnected";
            console.log('Connection to websocket server closed.');
        });

        // 4. Setup a Publisher on the /chatter topic
        var chatterTopic = new ROSLIB.Topic({
            ros : ros,
            name : '/chatter',
            messageType : 'std_msgs/String'
        });

        let counter = 1;
        function publishMessage() {
            if (!ros.isConnected) {
                alert("Cannot send message: ROS is not connected.");
                return;
            }
            
            var msg = new ROSLIB.Message({
                data: "Hello from phone/web! Count: " + counter
            });
            chatterTopic.publish(msg);
            document.getElementById("action-log").innerHTML = "✅ Published: " + msg.data;
            counter++;
        }

        // 5. Setup Latency Tracking via Pub/Sub Ping-Pong (RTT)
        var pingTopic = new ROSLIB.Topic({
            ros : ros,
            name : '/web_ping',
            messageType : 'std_msgs/String'
        });

        var latencySpan = document.getElementById("latency-display");

        // Listen for our own ping to bounce back
        pingTopic.subscribe(function(message) {
            var pingReceiveTime = Date.now();
            
            // The message data contains the exact millisecond we sent it
            var sentTime = parseInt(message.data);
            var roundTripTime = pingReceiveTime - sentTime;
            
            // One-way network latency is roughly half the round trip
            var networkLatency = roundTripTime / 2;
            
            if (!isNaN(networkLatency)) {
                latencySpan.innerHTML = "<span class='metric'>" + networkLatency.toFixed(0) + " ms (Network)</span>";
                
                // Color coding based on speed
                if (networkLatency < 50) {
                    latencySpan.className = "status connected"; // Lightning fast
                } else if (networkLatency < 150) {
                    latencySpan.className = "status warning";   // Okay
                } else {
                    latencySpan.className = "status disconnected"; // Slow
                }
            }
        });

        // Fire a ping off to the ROS server every 1 second
        setInterval(function() {
            if (ros.isConnected) {
                var now = Date.now();
                var msg = new ROSLIB.Message({
                    data: now.toString()
                });
                pingTopic.publish(msg);
            }
        }, 1000);
    </script>
</body>
</html>
"""

@app.get("/")
async def get_dashboard():
    return HTMLResponse(html_content)

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
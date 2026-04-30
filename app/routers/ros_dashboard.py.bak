# app/routers/ros_dashboard.py
from fastapi import APIRouter
from fastapi.responses import HTMLResponse

# Router'ı tanımla
router = APIRouter(
    prefix="/ros",
    tags=["ROS Dashboard"]
)

# HTML içeriğini buraya yerleştir
html_content = """
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ROS 2 + FastAPI Dashboard</title>
    <script>
        // DİKKAT: Buradaki adresi arkadaşının dışa açık adresiyle değiştirmeyi unutma!
        // Şimdilik test için localhost kalabilir ama Hetzner'de patlar.
        var robot_ip = "ARKADASININ_NGROK_VEYA_PUBLIC_IPSI"; // Örnek: "1.tcp.eu.ngrok.io:12345"
        
        // ... (Kodun geri kalanı) ...
    </script>
</head>
<body>
    </body>
</html>
"""

@router.get("/dashboard", summary="ROS 2 Test Panosunu Açar")
async def get_dashboard():
    return HTMLResponse(content=html_content)

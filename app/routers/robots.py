from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.robot import RobotCatalog

router = APIRouter(prefix="/api/robots", tags=["robots"])

ROBOT_DETAIL_PROFILES = {
    "rob100": {
        "tagline": "Unmanned Ground Vehicle",
        "hero_image": "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1600&q=80",
        "features": [
            {"title": "Autonomous Navigation", "body": "High-density mapping and reliable obstacle avoidance for laboratory and field deployments."},
            {"title": "Advanced Perception", "body": "Integrated camera and LIDAR sensor suite delivers 360° situational awareness."},
            {"title": "Modular Payload", "body": "Easy accessory mounting and rapid tool swaps for research, inspection, and delivery."},
        ],
        "specs": {
            "dimensions": "450 x 385 x 150 mm",
            "weight": "6.5 kg",
            "maxPayload": "3.2 kg",
            "maxSpeed": "1.4 m/s",
            "runTime": "4.2 hours",
            "battery": "Li-ion 22Ah / 48V",
        },
        "packages": [
            {"name": "STANDARD ODOMETRY", "image": "https://images.unsplash.com/photo-1519148246708-99b7b5f60196?auto=format&fit=crop&w=900&q=80", "description": "Reliable wheel odometry with drift-correction for indoor research missions."},
            {"name": "LIDAR PACKAGE", "image": "https://images.unsplash.com/photo-1581091870617-3b2f76d10abd?auto=format&fit=crop&w=900&q=80", "description": "Full 360° LIDAR package for robust navigation in dynamic environments."},
        ],
        "gallery": [
            "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1000&q=80",
            "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1000&q=80",
            "https://images.unsplash.com/photo-1512446733611-9099a758e9b0?auto=format&fit=crop&w=1000&q=80",
        ],
        "blueprints": [
            {"label": "Top View", "image": "https://images.unsplash.com/photo-1545239351-1141bd82e8a6?auto=format&fit=crop&w=800&q=80"},
            {"label": "Side View", "image": "https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=800&q=80"},
            {"label": "Front View", "image": "https://images.unsplash.com/photo-1521791136064-7986c2920216?auto=format&fit=crop&w=800&q=80"},
        ],
    },
    "rob200": {
        "tagline": "Field-Tested Mobility",
        "hero_image": "https://images.unsplash.com/photo-1496307042754-b4aa456c4a2d?auto=format&fit=crop&w=1600&q=80",
        "features": [
            {"title": "Lightweight Design", "body": "Compact chassis and optimized powertrain deliver fast deployment and easy handling."},
            {"title": "Resilient Navigation", "body": "Robust path planning in corridor and warehouse environments with stable control loops."},
            {"title": "Extended Battery", "body": "Optimized power management extends runtime for longer experiments and training sessions."},
        ],
        "specs": {
            "dimensions": "420 x 350 x 145 mm",
            "weight": "5.2 kg",
            "maxPayload": "2.0 kg",
            "maxSpeed": "1.2 m/s",
            "runTime": "3.8 hours",
            "battery": "Li-ion 18Ah / 48V",
        },
        "packages": [
            {"name": "STANDARD ODOMETRY", "image": "https://images.unsplash.com/photo-1519148246708-99b7b5f60196?auto=format&fit=crop&w=900&q=80", "description": "Proven odometry package for indoor navigation and consistent path tracking."},
            {"name": "LIDAR PACKAGE", "image": "https://images.unsplash.com/photo-1581091870617-3b2f76d10abd?auto=format&fit=crop&w=900&q=80", "description": "Enhanced scanning package for dense mapping and slow-speed obstacle detection."},
        ],
        "gallery": [
            "https://images.unsplash.com/photo-1545239351-1141bd82e8a6?auto=format&fit=crop&w=1000&q=80",
            "https://images.unsplash.com/photo-1512446733611-9099a758e9b0?auto=format&fit=crop&w=1000&q=80",
            "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1000&q=80",
        ],
        "blueprints": [
            {"label": "Top View", "image": "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=800&q=80"},
            {"label": "Side View", "image": "https://images.unsplash.com/photo-1521791136064-7986c2920216?auto=format&fit=crop&w=800&q=80"},
            {"label": "Front View", "image": "https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=800&q=80"},
        ],
    },
}

@router.get("/market")
def get_market_robots(db: Session = Depends(get_db)):
    robots = db.query(RobotCatalog).filter(RobotCatalog.is_available == True).all()
    return [
        {
            "id": r.id,
            "name": r.name,
            "description": getattr(r, "description", ""),
            "price": r.price,
            "type": getattr(r, "type", ""),
            "icon": getattr(r, "icon", "🤖"),
            "stock_count": getattr(r, "stock_count", 0),
            "is_available": getattr(r, "is_available", True),
        }
        for r in robots
    ]

@router.get("/{id}")
def get_robot_detail(id: int, db: Session = Depends(get_db)):
    robot = db.query(RobotCatalog).filter(RobotCatalog.id == id, RobotCatalog.is_available == True).first()
    if not robot:
        raise HTTPException(status_code=404, detail="Robot bulunamadı")

    profile = ROBOT_DETAIL_PROFILES.get(robot.ros_namespace or robot.name, {})

    return {
        "id": robot.id,
        "name": robot.name,
        "description": robot.description,
        "type": robot.type,
        "price": robot.price,
        "stock_count": robot.stock_count,
        "is_available": robot.is_available,
        "tagline": profile.get('tagline', 'Unmanned Ground Vehicle'),
        "hero_image": profile.get('hero_image'),
        "features": profile.get('features', []),
        "specs": profile.get('specs', {}),
        "packages": profile.get('packages', []),
        "gallery": profile.get('gallery', []),
        "blueprints": profile.get('blueprints', []),
    }

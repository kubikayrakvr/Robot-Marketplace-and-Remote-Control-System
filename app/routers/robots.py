from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.robot import RobotCatalog

router = APIRouter(prefix="/api/robots", tags=["robots"])

ROBOT_DETAIL_PROFILES = {
    "rob100": {
        "tagline": "Unmanned Ground Vehicle",
        "hero_image": "/robots/waffle_pi.svg",
        "icon": "/robots/waffle_pi.svg",
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
            {"name": "STANDARD ODOMETRY", "image": "/robots/packages/odometry.svg", "description": "Reliable wheel odometry with drift-correction for indoor research missions."},
            {"name": "LIDAR PACKAGE", "image": "/robots/packages/lidar.svg", "description": "Full 360° LIDAR package for robust navigation in dynamic environments."},
        ],
        "gallery": [
            "/robots/waffle_gallery/01.svg",
            "/robots/waffle_gallery/02.svg",
            "/robots/waffle_gallery/03.svg",
        ],
        "blueprints": [
            {"label": "Top View", "image": "/robots/blueprints/top.svg"},
            {"label": "Side View", "image": "/robots/blueprints/side.svg"},
            {"label": "Front View", "image": "/robots/blueprints/front.svg"},
        ],
    },
    "rob200": {
        "tagline": "Field-Tested Mobility",
        "hero_image": "/robots/burger.svg",
        "icon": "/robots/burger.svg",
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
            {"name": "STANDARD ODOMETRY", "image": "/robots/packages/odometry.svg", "description": "Proven odometry package for indoor navigation and consistent path tracking."},
            {"name": "LIDAR PACKAGE", "image": "/robots/packages/lidar.svg", "description": "Enhanced scanning package for dense mapping and slow-speed obstacle detection."},
        ],
        "gallery": [
            "/robots/burger_gallery/01.svg",
            "/robots/burger_gallery/02.svg",
            "/robots/burger_gallery/03.svg",
        ],
        "blueprints": [
            {"label": "Top View", "image": "/robots/blueprints/top.svg"},
            {"label": "Side View", "image": "/robots/blueprints/side.svg"},
            {"label": "Front View", "image": "/robots/blueprints/front.svg"},
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
            "icon": ROBOT_DETAIL_PROFILES.get(r.ros_namespace or r.name, {}).get('icon', '🤖'),
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

from app.database import SessionLocal
# Tüm modelleri açıkça içe aktararak SQLAlchemy sınıf kaydını (mapping) başlatıyoruz
from app.models.user import User
from app.models.shop import CartItem, Order, OrderItem
from app.models.report import UserReport
from app.models.audit import AuditLog
from app.models.robot import RobotCatalog, RobotInventory, UserRobot


# Each catalog row corresponds to exactly one simulator robot in the Gazebo
# fleet. The `ros_namespace` field is what wires this whole chain together:
#
#   activation → user_robot.py reads ros_namespace
#              → derives rosRobotId = "ROB-<num>"
#              → frontend ControlSelectionPage filters by rosRobotId
#              → ros_dashboard._NS_TO_TYPE maps namespace → spawner SDF model
#
# Adding a new robot to the system is a two-step process:
#   1. Add an entry here with a fresh `ros_namespace` (e.g. "rob400").
#   2. Add the same key to `_NS_TO_TYPE` in app/routers/ros_dashboard.py
#      pointing at one of the available SDF models under
#      ros_integration/src/robot_spawner/models/.
FLEET = [
    {
        "name":          "TurtleBot3 Waffle Pi · Lab α",
        "type":          "Kara Robotu (Kameralı)",
        "price":         18000.0,
        "description":   "ROS 2 + Gazebo lab birimi. Kamera, 360° LIDAR, 9-DOF IMU.",
        "ros_namespace": "rob100",
        "stock_count":   5,
    },
    {
        "name":          "TurtleBot3 Burger · Lab β",
        "type":          "Kara Robotu",
        "price":         12000.0,
        "description":   "ROS 2 + Gazebo lab birimi. 360° LIDAR, 9-DOF IMU (kamerasız).",
        "ros_namespace": "rob200",
        "stock_count":   5,
    },
    {
        "name":          "TurtleBot3 Waffle Pi · Lab γ",
        "type":          "Kara Robotu (Kameralı)",
        "price":         18000.0,
        "description":   "ROS 2 + Gazebo lab birimi. Kamera, 360° LIDAR, 9-DOF IMU.",
        "ros_namespace": "rob300",
        "stock_count":   5,
    },
]


def init_catalog():
    db = SessionLocal()
    print("Veritabanına bağlanıldı...")

    for r_data in FLEET:
        # Idempotent: key on ros_namespace, not on name. If you ever rename a
        # unit, the existing row gets reused instead of duplicated.
        robot = (
            db.query(RobotCatalog)
              .filter(RobotCatalog.ros_namespace == r_data["ros_namespace"])
              .first()
        )

        if robot is None:
            robot = RobotCatalog(
                name=r_data["name"],
                type=r_data["type"],
                price=r_data["price"],
                description=r_data["description"],
                stock_count=r_data["stock_count"],
                is_available=True,
                ros_namespace=r_data["ros_namespace"],
            )
            db.add(robot)
            db.flush()
            print(f"Katalog oluşturuldu: {r_data['name']}  ({r_data['ros_namespace']})")
        else:
            # Re-running the script is safe — refresh the editable fields so
            # tweaks above propagate without needing to wipe the DB.
            robot.name        = r_data["name"]
            robot.type        = r_data["type"]
            robot.price       = r_data["price"]
            robot.description = r_data["description"]
            robot.stock_count = r_data["stock_count"]
            robot.is_available = True
            print(f"Katalog güncellendi:  {r_data['name']}  ({r_data['ros_namespace']})")

        # Stock-aligned inventory. Each physical unit gets a unique serial +
        # activation code so multiple users can hold "licences" against the
        # same simulator robot — but the claim/heartbeat layer enforces that
        # only one of them drives at a time.
        existing = db.query(RobotInventory).filter(RobotInventory.catalog_id == robot.id).count()
        needed   = r_data["stock_count"] - existing
        if needed > 0:
            ns_short = r_data["ros_namespace"].upper()        # e.g. ROB100
            print(f"  --> {needed} adet fiziksel envanter ekleniyor.")
            for i in range(existing + 1, existing + needed + 1):
                db.add(RobotInventory(
                    catalog_id=robot.id,
                    serial_number=f"{ns_short}-2026-{i:03d}",
                    activation_code=f"ACT-{ns_short}-{i:03d}",
                    is_activated=False,
                ))

    try:
        db.commit()
        print("\nTüm değişiklikler kaydedildi.")
        print("\nAktivasyon kodları:")
        for r_data in FLEET:
            ns_short = r_data["ros_namespace"].upper()
            for i in range(1, r_data["stock_count"] + 1):
                print(f"  ACT-{ns_short}-{i:03d}   →  {r_data['name']}")
    except Exception as e:
        db.rollback()
        print(f"\nHata oluştu, değişiklikler geri alındı: {e}")
    finally:
        db.close()


if __name__ == "__main__":
    init_catalog()

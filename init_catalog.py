from app.database import SessionLocal
# Importing every model module up front populates SQLAlchemy's class registry
# so the string references inside relationship() (e.g. "User", "CartItem")
# can be resolved when the first query triggers mapper configuration. The
# FastAPI app gets these for free via the router imports; this standalone
# script doesn't, so we pull them in explicitly.
from app.models import user, robot, shop, audit  # noqa: F401
from app.models.robot import RobotCatalog

def init_catalog():
    db = SessionLocal()
    fixed_robots = [
        {"name": "AeroBot X1", "type": "Hava Robotu", "price": 15000.0, "description": "Gelişmiş otonom uçuş yeteneklerine sahip drone sistemi."},
        {"name": "TerraCrawler V2", "type": "Kara Robotu", "price": 12000.0, "description": "Engebeli araziler için tasarlanmış paletli keşif robotu."},
        {"name": "Sentinel Biped", "type": "İnsansı Robot", "price": 25000.0, "description": "İki ayak üzerinde hareket edebilen denge odaklı insansı robot."},
        {"name": "AquaDrone v70", "type": "Su Altı Robotu", "price": 18000.0, "description": "Su altı gözlem ve veri toplama operasyonları için ideal çözüm."}
    ]

    for r_data in fixed_robots:
        exists = db.query(RobotCatalog).filter(RobotCatalog.name == r_data["name"]).first()
        if not exists:
            new_r = RobotCatalog(
                name=r_data["name"],
                type=r_data["name"], # Kullanıcı 'type' alanına bu isimlerin gelmesini istemişti (resme göre)
                price=r_data["price"],
                description=r_data["description"],
                stock_count=0
            )
            db.add(new_r)
            print(f"Created model: {r_data['name']}")
    
    db.commit()
    db.close()

if __name__ == "__main__":
    init_catalog()

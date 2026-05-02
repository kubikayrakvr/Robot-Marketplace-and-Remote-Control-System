from app.database import SessionLocal
# Tüm modelleri açıkça içe aktararak SQLAlchemy sınıf kaydını (mapping) başlatıyoruz
from app.models.user import User
from app.models.shop import CartItem, Order, OrderItem
from app.models.report import UserReport
from app.models.audit import AuditLog
from app.models.robot import RobotCatalog, RobotInventory, UserRobot

def init_catalog():
    db = SessionLocal()
    print("Veritabanına bağlanıldı...")

    fixed_robots = [
        {"name": "AeroBot X1", "type": "Hava Robotu", "price": 15000.0, "description": "Gelişmiş otonom uçuş yeteneklerine sahip drone sistemi."},
        {"name": "TerraCrawler V2", "type": "Kara Robotu", "price": 12000.0, "description": "Engebeli araziler için tasarlanmış paletli keşif robotu."},
        {"name": "Sentinel Biped", "type": "İnsansı Robot", "price": 25000.0, "description": "İki ayak üzerinde hareket edebilen denge odaklı insansı robot."},
        {"name": "AquaDrone v70", "type": "Su Altı Robotu", "price": 18000.0, "description": "Su altı gözlem ve veri toplama operasyonları için ideal çözüm."}
    ]

    for r_data in fixed_robots:
        # Katalogda robotun olup olmadığını kontrol et
        robot = db.query(RobotCatalog).filter(RobotCatalog.name == r_data["name"]).first()
        
        if not robot:
            robot = RobotCatalog(
                name=r_data["name"],
                type=r_data["type"],  # 'name' yerine doğru 'type' alanı kullanıldı
                price=r_data["price"],
                description=r_data["description"],
                stock_count=10,       # Katalogda görünen stok
                is_available=True
            )
            db.add(robot)
            db.flush()  # ID'yi alabilmek için geçici olarak gönderiyoruz
            print(f"Katalog oluşturuldu: {r_data['name']}")
        else:
            print(f"Katalog zaten mevcut: {r_data['name']}")

        # Envanter (RobotInventory) kontrolü
        # Ödeme ekranında hata almamak için fiziksel birimlerin eklenmesi şarttır
        inventory_count = db.query(RobotInventory).filter(RobotInventory.catalog_id == robot.id).count()
        if inventory_count == 0:
            print(f"  --> {r_data['name']} için fiziksel envanter birimleri oluşturuluyor...")
            for i in range(1, 6): # Her model için 5 adet fiziksel birim ekler
                new_unit = RobotInventory(
                    catalog_id=robot.id,
                    serial_number=f"{robot.name[:3].upper()}-{2026}-{i:03d}",
                    activation_code=f"ACT-{robot.name[:3].upper()}-{i:03d}",
                    is_activated=False
                )
                db.add(new_unit)
        
    try:
        db.commit()
        print("\nTüm değişiklikler başarıyla kaydedildi.")
    except Exception as e:
        db.rollback()
        print(f"\nHata oluştu, değişiklikler geri alındı: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    init_catalog()
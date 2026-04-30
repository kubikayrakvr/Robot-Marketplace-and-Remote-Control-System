from sqlalchemy import text
from app.database import engine

def fix():
    with engine.connect() as conn:
        print("Checking users table...")
        # Add security_question if missing
        try:
            conn.execute(text("ALTER TABLE users ADD COLUMN security_question TEXT"))
            conn.commit()
            print("Added security_question column.")
        except Exception as e:
            print(f"security_question column check: {e}")

        # Add security_answer if missing
        try:
            conn.execute(text("ALTER TABLE users ADD COLUMN security_answer TEXT"))
            conn.commit()
            print("Added security_answer column.")
        except Exception as e:
            print(f"security_answer column check: {e}")
        
        print("Done.")

if __name__ == "__main__":
    fix()

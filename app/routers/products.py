from fastapi import APIRouter, Depends, Query, HTTPException, Response
from sqlalchemy.orm import Session
from sqlalchemy import asc, desc, text
from typing import Optional
from app.database import get_db
from app.models.robot import RobotCatalog
from app.schemas.product import ProductResponse, ProductListResponse
import hashlib
import base64

router = APIRouter(prefix="/api/products", tags=["shop"])


# Cursor Helpers
def encode_cursor(price: float, id: int) -> str:
    raw = f"{price}:{id}"
    return base64.urlsafe_b64encode(raw.encode()).decode()


def decode_cursor(cursor: str):
    try:
        decoded = base64.urlsafe_b64decode(cursor.encode()).decode()
        price_str, id_str = decoded.split(":")
        return float(price_str), int(id_str)
    except Exception:
        return None, None


# LIST PRODUCTS
@router.get("/", response_model=ProductListResponse)
def list_products(
    cursor: Optional[str] = Query(None, description="Pagination cursor"),
    limit: int = Query(20, ge=1, le=100),
    sort: str = Query(
        "id_asc",
        regex="^(id_asc|id_desc|price_asc|price_desc|name_asc|name_desc)$"
    ),
    db: Session = Depends(get_db)
):
    """
    Production-ready ürün listeleme:
    - Keyset pagination
    - Composite cursor (price + id)
    - Approximate count
    - Sort desteği
    """

    # 🔹 Approximate count
    res = db.execute(text(
        "SELECT reltuples::bigint AS estimate FROM pg_class WHERE relname = 'robot_catalog'"
    ))
    total_estimate = res.scalar() or 0

    # 🔹 Base query
    query = db.query(RobotCatalog).filter(RobotCatalog.is_available == True)

    # 🔹 Sort map
    sort_map = {
        "id_asc": asc(RobotCatalog.id),
        "id_desc": desc(RobotCatalog.id),
        "price_asc": asc(RobotCatalog.price),
        "price_desc": desc(RobotCatalog.price),
        "name_asc": asc(RobotCatalog.name),
        "name_desc": desc(RobotCatalog.name),
    }

    order_clause = sort_map.get(sort, asc(RobotCatalog.id))

    # KEYSET LOGIC
    if sort.startswith("id") and cursor:
        try:
            c_id = int(cursor)
            if sort == "id_asc":
                query = query.filter(RobotCatalog.id > c_id)
            else:
                query = query.filter(RobotCatalog.id < c_id)
        except ValueError:
            pass

    elif sort.startswith("price") and cursor:
        c_price, c_id = decode_cursor(cursor)

        if c_price is not None:
            if sort == "price_asc":
                query = query.filter(
                    (RobotCatalog.price > c_price) |
                    ((RobotCatalog.price == c_price) & (RobotCatalog.id > c_id))
                )
            else:
                query = query.filter(
                    (RobotCatalog.price < c_price) |
                    ((RobotCatalog.price == c_price) & (RobotCatalog.id < c_id))
                )

    # name sort → fallback (cursor yok)
    # çünkü string + keyset = ayrı dert (şimdilik gerek yok)

    # 🔹 Execute
    items = query.order_by(order_clause).limit(limit).all()

    # 🔹 Next cursor üretimi
    if items:
        last = items[-1]
        if sort.startswith("price"):
            next_cursor = encode_cursor(last.price, last.id)
        elif sort.startswith("id"):
            next_cursor = str(last.id)
        else:
            next_cursor = None
    else:
        next_cursor = None

    return {
        "items": items,
        "total_estimate": total_estimate,
        "next_cursor": next_cursor,
        "limit": limit,
        "sort": sort
    }


# PRODUCT DETAIL
@router.get("/{id}", response_model=ProductResponse)
def get_product_detail(id: int, response: Response, db: Session = Depends(get_db)):
    """
    Ürün detay:
    - is_available güvenliği
    - güçlü ETag
    """

    product = db.query(RobotCatalog).filter(
        RobotCatalog.id == id,
        RobotCatalog.is_available == True
    ).first()

    if not product:
        raise HTTPException(status_code=404, detail="Ürün bulunamadı")

    etag_content = f"{product.id}-{product.name}-{product.price}-{product.stock_count}-{product.version}"
    etag = hashlib.md5(etag_content.encode()).hexdigest()

    response.headers["ETag"] = etag

    return product

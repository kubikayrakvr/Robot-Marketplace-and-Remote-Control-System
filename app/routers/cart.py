from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session, joinedload
from app.database import get_db
from app.models.user import User
from app.models.robot import RobotCatalog
from app.models.shop import CartItem
from app.schemas.cart import CartItemCreate, CartItemUpdate, CartTotalResponse, CartItemResponse
from app.core.dependencies import get_current_user
from app.core.limiter import limiter
from decimal import Decimal

router = APIRouter(prefix="/api/cart", tags=["shop-cart"])

@router.get("/", response_model=CartTotalResponse)
@limiter.limit("30/minute") # Dakikada 30 kez sepetine bakabilir
def get_cart(request: Request, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    items = (
        db.query(CartItem)
        .options(joinedload(CartItem.product))
        .filter(CartItem.user_id == current_user.id)
        .all()
    )

    total = sum(Decimal(item.unit_price) * item.quantity for item in items)

    response_items = [
        CartItemResponse(
            id=item.id,
            product_id=item.product_id,
            product_name=item.product.name,
            unit_price=item.unit_price,
            quantity=item.quantity,
            subtotal=Decimal(item.unit_price) * item.quantity
        ) for item in items
    ]

    return {"items": response_items, "total_price": total}


@router.post("/items", status_code=201)
@limiter.limit("10/minute") # Sepete eklemeyi botlardan koruyoruz
def add_item_to_cart(
    request: Request, 
    data: CartItemCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    product = db.query(RobotCatalog).filter(
        RobotCatalog.id == data.product_id,
        RobotCatalog.is_available == True
    ).with_for_update().first()

    if not product:
        raise HTTPException(status_code=404, detail="Ürün bulunamadı veya satışta değil")

    if product.stock_count < data.quantity:
        raise HTTPException(status_code=400, detail="Yetersiz stok")

    item = db.query(CartItem).filter(
        CartItem.user_id == current_user.id,
        CartItem.product_id == data.product_id
    ).first()

    if item:
        if product.stock_count < item.quantity + data.quantity:
            raise HTTPException(status_code=400, detail="Yetersiz stok")
        item.quantity += data.quantity
    else:
        item = CartItem(
            user_id=current_user.id,
            product_id=data.product_id,
            quantity=data.quantity,
            unit_price=product.price
        )
        db.add(item)

    db.commit()
    return {"message": "Ürün sepete eklendi"}


@router.patch("/items/{itemId}")
@limiter.limit("10/minute")
def update_cart_item(
    request: Request,
    itemId: int,
    data: CartItemUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    item = db.query(CartItem).filter(
        CartItem.id == itemId,
        CartItem.user_id == current_user.id
    ).first()

    if not item:
        raise HTTPException(status_code=404, detail="Sepet öğesi bulunamadı")

    if data.quantity == 0:
        db.delete(item)
        db.commit()
        return {"message": "Ürün sepetten çıkarıldı"}

    product = db.query(RobotCatalog).filter(
        RobotCatalog.id == item.product_id
    ).with_for_update().first()

    if product.stock_count < data.quantity:
        raise HTTPException(status_code=400, detail="Seçilen miktar stok sınırını aşıyor")

    item.quantity = data.quantity
    db.commit()
    return {"message": "Sepet güncellendi"}


@router.delete("/")
def clear_my_cart(request: Request, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db.query(CartItem).filter(CartItem.user_id == current_user.id).delete()
    db.commit()
    return {"message": "Sepet temizlendi"}

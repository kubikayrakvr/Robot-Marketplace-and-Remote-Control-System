from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session, joinedload
from app.database import get_db
from app.models.user import User
from app.models.robot import RobotCatalog, RobotInventory, UserRobot
from app.models.shop import CartItem, Order, OrderItem, OrderStatus
from app.models.audit import AuditLog
from app.schemas.order import OrderCreate, OrderResponse
from app.core.dependencies import get_current_user
from app.core.limiter import limiter
from typing import List
from decimal import Decimal

router = APIRouter(prefix="/api/orders", tags=["orders"])


@router.post("/")
@limiter.limit("3/minute")
def create_order(
    request: Request,
    data: OrderCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    cart_items = db.query(CartItem).filter(CartItem.user_id == current_user.id).all()
    if not cart_items:
        raise HTTPException(status_code=400, detail="Sepetiniz boş")

    product_ids = [ci.product_id for ci in cart_items]
    products = db.query(RobotCatalog).filter(RobotCatalog.id.in_(product_ids)).with_for_update().all()
    products_map = {p.id: p for p in products}

    total_amount = Decimal(0)
    order_items_to_create = []

    try:
        for ci in cart_items:
            product = products_map.get(ci.product_id)
            if not product or not product.is_available:
                raise HTTPException(status_code=400, detail=f"Ürün {ci.product_id} artık mevcut değil")

            if Decimal(ci.unit_price) != Decimal(product.price):
                raise HTTPException(status_code=400, detail=f"Fiyat değişti: {product.name}")

            # Henüz satılmamış (UserRobot kaydı olmayan) envanter ürünlerini al
            inventory_items = db.query(RobotInventory).filter(
                RobotInventory.catalog_id == product.id,
                ~RobotInventory.user_robot.has()
            ).limit(ci.quantity).with_for_update().all()

            if len(inventory_items) < ci.quantity:
                raise HTTPException(status_code=400, detail=f"{product.name} için yeterli stok yok")

            total_amount += Decimal(ci.unit_price) * ci.quantity
            order_items_to_create.append({
                "ci": ci,
                "product": product,
                "inv": inventory_items
            })

        # Siparişi oluştur
        new_order = Order(
            user_id=current_user.id,
            total_amount=total_amount,
            status=OrderStatus.PAID
        )
        db.add(new_order)
        db.flush()

        for item in order_items_to_create:
            # Sipariş kalemi
            oi = OrderItem(
                order_id=new_order.id,
                product_id=item["product"].id,
                quantity=item["ci"].quantity,
                unit_price=item["ci"].unit_price
            )
            db.add(oi)

            # Stok düş
            item["product"].stock_count -= item["ci"].quantity

            # Her envanter ürünü için:
            # - Sadece UserRobot kaydı oluştur (is_activated=False olarak kalır)
            for inv in item["inv"]:
                user_robot = UserRobot(
                    user_id=current_user.id,
                    inventory_id=inv.id,
                    nickname=item["product"].name,  # Varsayılan takma ad
                )
                db.add(user_robot)

        # Sepeti temizle
        db.query(CartItem).filter(CartItem.user_id == current_user.id).delete()

        # Audit log
        log = AuditLog(
            user_id=current_user.id,
            action="ORDER_CREATED",
            ip_address=request.client.host,
            details={"order_id": new_order.id, "total": str(total_amount)}
        )
        db.add(log)

        db.commit()
        db.refresh(new_order)
        return new_order

    except Exception as e:
        db.rollback()
        raise e


@router.get("/")
def get_my_orders(request: Request, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    orders = db.query(Order).options(joinedload(Order.items)).filter(
        Order.user_id == current_user.id
    ).order_by(Order.created_at.desc()).all()

    result = []
    for order in orders:
        items = []
        for item in order.items:
            product = db.query(RobotCatalog).filter(RobotCatalog.id == item.product_id).first()
            items.append({
                "product_id": item.product_id,
                "quantity": item.quantity,
                "unit_price": float(item.unit_price),
                "product_name": product.name if product else "Bilinmeyen",
                "subtotal": float(item.unit_price) * item.quantity,
            })
        result.append({
            "id": order.id,
            "total_amount": float(order.total_amount),
            "status": order.status.value,
            "created_at": order.created_at.isoformat(),
            "items": items,
        })
    return result

@router.get("/{id}", response_model=OrderResponse)
def get_order_detail(
    request: Request,
    id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    order = db.query(Order).options(joinedload(Order.items)).filter(
        Order.id == id,
        Order.user_id == current_user.id
    ).first()
    if not order:
        raise HTTPException(status_code=404, detail="Sipariş bulunamadı")
    return order

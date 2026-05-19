"""Hostel management API — rooms, allocations, occupancy tracking."""
from flask import Blueprint, g, request
from flask_jwt_extended import jwt_required

from app.extensions import db
from app.models.hostel import Hostel, HostelRoom, HostelAllocation
from app.utils.response import success_response, created_response, no_content_response, error_response
from app.utils.decorators import school_required, role_required

hostel_bp = Blueprint("hostel", __name__, url_prefix="/hostel")


# ── Serializers ────────────────────────────────────────────────────────────────
def _hostel_dict(h: Hostel) -> dict:
    return {
        "id": str(h.id),
        "name": h.name,
        "type": h.type,
        "warden_name": h.warden_name,
        "warden_phone": h.warden_phone,
        "total_capacity": h.total_capacity,
        "description": h.description,
        "is_active": h.is_active,
        "room_count": h.rooms.filter_by(is_deleted=False).count(),
        "created_at": h.created_at.isoformat() if h.created_at else None,
    }


def _room_dict(r: HostelRoom) -> dict:
    return {
        "id": str(r.id),
        "hostel_id": str(r.hostel_id),
        "hostel_name": r.hostel.name if r.hostel else None,
        "room_number": r.room_number,
        "floor": r.floor,
        "capacity": r.capacity,
        "room_type": r.room_type,
        "monthly_fee": float(r.monthly_fee) if r.monthly_fee else 0,
        "occupied_count": r.occupied_count,
        "available_beds": max(0, r.capacity - r.occupied_count),
        "is_full": r.is_full,
        "is_active": r.is_active,
    }


def _alloc_dict(a: HostelAllocation) -> dict:
    student = a.student
    return {
        "id": str(a.id),
        "room_id": str(a.room_id),
        "student_id": str(a.student_id),
        "student_name": f"{student.first_name} {student.last_name}".strip() if student else None,
        "student_roll": getattr(student, "roll_number", None) if student else None,
        "check_in_date": a.check_in_date.isoformat() if a.check_in_date else None,
        "check_out_date": a.check_out_date.isoformat() if a.check_out_date else None,
        "status": a.status,
        "notes": a.notes,
        "created_at": a.created_at.isoformat() if a.created_at else None,
    }


# ── Hostels (buildings) ────────────────────────────────────────────────────────
@hostel_bp.route("", methods=["GET"])
@jwt_required()
@school_required
def list_hostels():
    """List all hostels for the school."""
    hostels = Hostel.query.filter_by(school_id=g.school_id, is_deleted=False).all()
    return success_response([_hostel_dict(h) for h in hostels])


@hostel_bp.route("", methods=["POST"])
@jwt_required()
@school_required
@role_required("school_admin")
def create_hostel():
    data = request.get_json() or {}
    if not data.get("name"):
        return error_response("name is required", 422)
    hostel = Hostel(
        school_id=g.school_id,
        name=data["name"],
        type=data.get("type", "boys"),
        warden_name=data.get("warden_name"),
        warden_phone=data.get("warden_phone"),
        total_capacity=int(data.get("total_capacity", 0)),
        description=data.get("description"),
    )
    db.session.add(hostel)
    db.session.commit()
    return created_response(_hostel_dict(hostel))


@hostel_bp.route("/<uuid:hostel_id>", methods=["PUT"])
@jwt_required()
@school_required
@role_required("school_admin")
def update_hostel(hostel_id):
    hostel = Hostel.query.filter_by(id=hostel_id, school_id=g.school_id, is_deleted=False).first_or_404()
    data = request.get_json() or {}
    for key in ("name", "type", "warden_name", "warden_phone", "total_capacity", "description", "is_active"):
        if key in data:
            setattr(hostel, key, data[key])
    db.session.commit()
    return success_response(_hostel_dict(hostel))


@hostel_bp.route("/<uuid:hostel_id>", methods=["DELETE"])
@jwt_required()
@school_required
@role_required("school_admin")
def delete_hostel(hostel_id):
    hostel = Hostel.query.filter_by(id=hostel_id, school_id=g.school_id, is_deleted=False).first_or_404()
    hostel.is_deleted = True
    db.session.commit()
    return no_content_response()


# ── Rooms ──────────────────────────────────────────────────────────────────────
@hostel_bp.route("/rooms", methods=["GET"])
@jwt_required()
@school_required
def list_rooms():
    """List all rooms, optionally filtered by hostel."""
    hostel_id = request.args.get("hostel_id")
    query = HostelRoom.query.filter_by(school_id=g.school_id, is_deleted=False)
    if hostel_id:
        query = query.filter_by(hostel_id=hostel_id)
    rooms = query.order_by(HostelRoom.room_number).all()
    return success_response([_room_dict(r) for r in rooms])


@hostel_bp.route("/rooms", methods=["POST"])
@jwt_required()
@school_required
@role_required("school_admin")
def create_room():
    data = request.get_json() or {}
    for req_field in ("hostel_id", "room_number", "capacity"):
        if not data.get(req_field):
            return error_response(f"{req_field} is required", 422)
    hostel = Hostel.query.filter_by(id=data["hostel_id"], school_id=g.school_id).first_or_404()
    room = HostelRoom(
        school_id=g.school_id,
        hostel_id=hostel.id,
        room_number=data["room_number"],
        floor=data.get("floor"),
        capacity=int(data["capacity"]),
        room_type=data.get("room_type", "standard"),
        monthly_fee=float(data.get("monthly_fee", 0)),
    )
    db.session.add(room)
    db.session.commit()
    return created_response(_room_dict(room))


@hostel_bp.route("/rooms/<uuid:room_id>", methods=["PUT"])
@jwt_required()
@school_required
@role_required("school_admin")
def update_room(room_id):
    room = HostelRoom.query.filter_by(id=room_id, school_id=g.school_id, is_deleted=False).first_or_404()
    data = request.get_json() or {}
    for key in ("room_number", "floor", "capacity", "room_type", "monthly_fee", "is_active"):
        if key in data:
            setattr(room, key, data[key])
    db.session.commit()
    return success_response(_room_dict(room))


@hostel_bp.route("/rooms/<uuid:room_id>", methods=["DELETE"])
@jwt_required()
@school_required
@role_required("school_admin")
def delete_room(room_id):
    room = HostelRoom.query.filter_by(id=room_id, school_id=g.school_id, is_deleted=False).first_or_404()
    room.is_deleted = True
    db.session.commit()
    return no_content_response()


# ── Allocations ────────────────────────────────────────────────────────────────
@hostel_bp.route("/allocations", methods=["GET"])
@jwt_required()
@school_required
def list_allocations():
    """List all active hostel allocations."""
    status = request.args.get("status", "active")
    room_id = request.args.get("room_id")
    query = HostelAllocation.query.filter_by(school_id=g.school_id, is_deleted=False)
    if status:
        query = query.filter_by(status=status)
    if room_id:
        query = query.filter_by(room_id=room_id)
    allocs = query.order_by(HostelAllocation.check_in_date.desc()).all()
    return success_response([_alloc_dict(a) for a in allocs])


@hostel_bp.route("/allocations", methods=["POST"])
@jwt_required()
@school_required
@role_required("school_admin")
def create_allocation():
    """Allocate a student to a room."""
    data = request.get_json() or {}
    for req_field in ("room_id", "student_id", "check_in_date"):
        if not data.get(req_field):
            return error_response(f"{req_field} is required", 422)

    room = HostelRoom.query.filter_by(id=data["room_id"], school_id=g.school_id, is_deleted=False).first_or_404()
    if room.is_full:
        return error_response("Room is full — no available beds", 422)

    # Check for existing active allocation for this student
    existing = HostelAllocation.query.filter_by(
        student_id=data["student_id"], status="active", is_deleted=False
    ).first()
    if existing:
        return error_response("Student is already allocated to a hostel room", 422)

    from datetime import date
    alloc = HostelAllocation(
        school_id=g.school_id,
        room_id=data["room_id"],
        student_id=data["student_id"],
        check_in_date=date.fromisoformat(data["check_in_date"]),
        notes=data.get("notes"),
        status="active",
    )
    db.session.add(alloc)
    db.session.commit()
    return created_response(_alloc_dict(alloc))


@hostel_bp.route("/allocations/<uuid:alloc_id>/checkout", methods=["POST"])
@jwt_required()
@school_required
@role_required("school_admin")
def checkout_allocation(alloc_id):
    """Mark a student as checked out from hostel."""
    alloc = HostelAllocation.query.filter_by(id=alloc_id, school_id=g.school_id, is_deleted=False).first_or_404()
    data = request.get_json() or {}
    from datetime import date
    alloc.status = "checked_out"
    alloc.check_out_date = date.fromisoformat(data.get("check_out_date", date.today().isoformat()))
    alloc.notes = data.get("notes", alloc.notes)
    db.session.commit()
    return success_response(_alloc_dict(alloc))


# ── Summary ────────────────────────────────────────────────────────────────────
@hostel_bp.route("/summary", methods=["GET"])
@jwt_required()
@school_required
def hostel_summary():
    """Return occupancy summary for all hostels."""
    hostels = Hostel.query.filter_by(school_id=g.school_id, is_deleted=False, is_active=True).all()
    result = []
    for h in hostels:
        rooms = h.rooms.filter_by(is_deleted=False, is_active=True).all()
        total_cap = sum(r.capacity for r in rooms)
        occupied = sum(r.occupied_count for r in rooms)
        result.append({
            "hostel_id": str(h.id),
            "hostel_name": h.name,
            "type": h.type,
            "total_rooms": len(rooms),
            "total_capacity": total_cap,
            "occupied": occupied,
            "available": max(0, total_cap - occupied),
            "occupancy_pct": round(occupied / total_cap * 100) if total_cap else 0,
        })
    return success_response(result)

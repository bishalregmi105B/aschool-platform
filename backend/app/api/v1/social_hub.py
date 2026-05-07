"""Social Hub API — posts, events, polls, groups."""
from flask import Blueprint, g, request
from flask_jwt_extended import jwt_required

from app.models.social import Post, Comment, Group
from app.plugins.decorators import plugin_required
from app.utils.decorators import role_required, school_required
from app.utils.pagination import paginate
from app.utils.response import created_response, error_response, no_content_response, success_response
from extensions import db

social_hub_bp = Blueprint("social_hub", __name__, url_prefix="/social")


# ── Posts (Feed) ──────────────────────────────────────────

@social_hub_bp.route("/posts", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("social_hub")
def list_posts():
    query = Post.query.filter_by(school_id=g.school_id, is_deleted=False)
    post_type = request.args.get("type")
    if post_type:
        query = query.filter_by(post_type=post_type)
    query = query.order_by(Post.created_at.desc())
    items, meta = paginate(query)
    return success_response([_post_dict(p) for p in items], meta={"pagination": meta})


@social_hub_bp.route("/posts", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("social_hub")
def create_post():
    data = request.get_json(silent=True) or {}
    post = Post(
        school_id=g.school_id,
        author_id=g.current_user.id,
        content=data.get("content", ""),
        post_type=data.get("type", "text"),
        media_urls=data.get("media_urls", []),
        visibility=data.get("visibility", "school"),
    )
    db.session.add(post)
    db.session.commit()
    return created_response(_post_dict(post))


@social_hub_bp.route("/posts/<post_id>", methods=["DELETE"])
@jwt_required()
@school_required
@plugin_required("social_hub")
def delete_post(post_id):
    post = Post.query.filter_by(id=post_id, school_id=g.school_id).first_or_404()
    if post.author_id != g.current_user.id and g.current_user.role not in ("superadmin", "school_admin"):
        return error_response("Not authorized", 403)
    post.is_deleted = True
    db.session.commit()
    return no_content_response()


@social_hub_bp.route("/posts/<post_id>/like", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("social_hub")
def toggle_like(post_id):
    post = Post.query.filter_by(id=post_id, school_id=g.school_id).first_or_404()
    user_id = str(g.current_user.id)
    likes = post.likes or []
    if user_id in likes:
        likes.remove(user_id)
        action = "unliked"
    else:
        likes.append(user_id)
        action = "liked"
    post.likes = likes
    db.session.commit()
    return success_response({"action": action, "total_likes": len(likes)})


# ── Comments ──────────────────────────────────────────────

@social_hub_bp.route("/posts/<post_id>/comments", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("social_hub")
def list_comments(post_id):
    query = Comment.query.filter_by(
        school_id=g.school_id,
        post_id=post_id,
        is_deleted=False,
    ).order_by(Comment.created_at)
    items, meta = paginate(query)
    return success_response([_comment_dict(c) for c in items], meta={"pagination": meta})


@social_hub_bp.route("/posts/<post_id>/comments", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("social_hub")
def create_comment(post_id):
    data = request.get_json(silent=True) or {}
    comment = Comment(
        school_id=g.school_id,
        post_id=post_id,
        author_id=g.current_user.id,
        content=data.get("content", ""),
    )
    db.session.add(comment)
    db.session.commit()
    return created_response(_comment_dict(comment))


# ── Groups ────────────────────────────────────────────────

@social_hub_bp.route("/groups", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("social_hub")
def list_groups():
    query = Group.query.filter_by(school_id=g.school_id, is_deleted=False)
    items, meta = paginate(query)
    return success_response([_group_dict(grp) for grp in items], meta={"pagination": meta})


@social_hub_bp.route("/groups", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("social_hub")
@role_required("superadmin", "school_admin", "teacher")
def create_group():
    data = request.get_json(silent=True) or {}
    grp = Group(
        school_id=g.school_id,
        name=data.get("name", ""),
        description=data.get("description", ""),
        group_type=data.get("type", "class"),
        created_by=g.current_user.id,
    )
    db.session.add(grp)
    db.session.commit()
    return created_response(_group_dict(grp))


def _post_dict(p):
    return {
        "id": str(p.id), "author_id": str(p.author_id) if p.author_id else None, "content": p.content,
        "post_type": p.post_type, "media_urls": p.media_urls or [],
        "likes_count": len(p.likes or []), "visibility": p.visibility,
        "created_at": str(p.created_at) if p.created_at else None,
    }


def _comment_dict(c):
    return {
        "id": str(c.id), "post_id": str(c.post_id) if c.post_id else None, "author_id": str(c.author_id) if c.author_id else None,
        "content": c.content,
        "created_at": str(c.created_at) if c.created_at else None,
    }


def _group_dict(g_obj):
    return {
        "id": str(g_obj.id), "name": g_obj.name, "description": g_obj.description,
        "group_type": g_obj.group_type, "member_count": g_obj.member_count if hasattr(g_obj, "member_count") else 0,
    }

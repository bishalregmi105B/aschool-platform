"""Social Hub API — posts, events, polls, groups, moderation."""
import uuid as _uuid

from flask import Blueprint, g, request
from flask_jwt_extended import jwt_required

from app.models.social import Comment, Group, GroupMember, Post
from app.plugins.decorators import plugin_required
from app.utils.decorators import role_required, school_required
from app.utils.pagination import paginate
from app.utils.response import created_response, error_response, no_content_response, success_response
from extensions import db

social_hub_bp = Blueprint("social_hub", __name__, url_prefix="/social")

ADMIN_ROLES = ("superadmin", "school_admin")


def _parse_uuid(value):
    """UUID or None — a junk path id must 404, never reach Postgres and
    raise DataError 500 (E196)."""
    if not value:
        return None
    if isinstance(value, _uuid.UUID):
        return value
    try:
        return _uuid.UUID(str(value))
    except (TypeError, ValueError, AttributeError):
        return None


def _get_post(post_id, include_hidden=False):
    pid = _parse_uuid(post_id)
    if not pid:
        return None
    post = Post.query.filter_by(id=pid, school_id=g.school_id).first()
    if not post or post.is_deleted:
        return None
    if post.is_hidden and not include_hidden and g.current_user.role not in ADMIN_ROLES:
        return None
    return post


def _is_group_member(group_id, user_id) -> bool:
    return (
        GroupMember.query.filter_by(
            group_id=group_id,
            user_id=user_id,
            school_id=g.school_id,
            is_deleted=False,
        ).first()
        is not None
    )


def _can_access_group_post(post) -> bool:
    """E195: group posts are for the group — members, the author, and
    school admins. Everyone else neither sees nor interacts."""
    if not post.group_id:
        return True
    if g.current_user.role in ADMIN_ROLES or str(post.author_id) == str(g.current_user.id):
        return True
    return _is_group_member(post.group_id, g.current_user.id)


def _sync_member_count(group) -> None:
    group.member_count = GroupMember.query.filter_by(
        group_id=group.id, school_id=g.school_id, is_deleted=False
    ).count()


# ── Posts (Feed) ──────────────────────────────────────────

@social_hub_bp.route("/posts", methods=["GET"])
@jwt_required()
@school_required
@plugin_required("social_hub")
def list_posts():
    query = Post.query.filter_by(school_id=g.school_id, is_deleted=False)
    # E194: hidden posts are pulled from every non-admin feed; admins see
    # everything by default (with the is_hidden flag) so they can moderate
    # what they cannot otherwise find.
    if g.current_user.role not in ADMIN_ROLES:
        query = query.filter(Post.is_hidden.isnot(True))
    # E195: group posts are visible to members (+ author/admins) only.
    if g.current_user.role not in ADMIN_ROLES:
        member_group_ids = [
            m.group_id for m in GroupMember.query.filter_by(
                user_id=g.current_user.id, school_id=g.school_id, is_deleted=False
            ).all()
        ]
        query = query.filter(
            (Post.group_id.is_(None))
            | (Post.author_id == g.current_user.id)
            | (Post.group_id.in_(member_group_ids))
        )
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
    content = (data.get("content") or "").strip()
    # E196: an empty post is not content — 400, not a blank feed row.
    if not content and not (data.get("media_urls") or []):
        return error_response("content or media_urls are required", 400)

    group_id = None
    if data.get("group_id"):
        group_id = _parse_uuid(data.get("group_id"))
        if not group_id:
            return error_response("group_id must be a UUID", 400)
        group = Group.query.filter_by(
            id=group_id, school_id=g.school_id, is_deleted=False
        ).first()
        if not group:
            return error_response("Group not found", 404)
        # E195: non-members cannot post into a group.
        if g.current_user.role not in ADMIN_ROLES and \
                not _is_group_member(group_id, g.current_user.id):
            return error_response("You must be a member of this group to post", 403)

    post = Post(
        school_id=g.school_id,
        author_id=g.current_user.id,
        content=content,
        post_type=data.get("type", "text"),
        media_urls=data.get("media_urls", []),
        visibility="group" if group_id else data.get("visibility", "school"),
        group_id=group_id,
    )
    db.session.add(post)
    db.session.commit()
    return created_response(_post_dict(post))


@social_hub_bp.route("/posts/<post_id>", methods=["DELETE"])
@jwt_required()
@school_required
@plugin_required("social_hub")
def delete_post(post_id):
    post = _get_post(post_id, include_hidden=True)
    if not post:
        return error_response("Post not found", 404)
    if post.author_id != g.current_user.id and g.current_user.role not in ADMIN_ROLES:
        return error_response("Not authorized", 403)
    post.is_deleted = True
    db.session.commit()
    return no_content_response()


# ── Moderation (E194) ─────────────────────────────────────
# Hiding flips real state (is_hidden / hidden_by_id) and the post actually
# disappears from every non-admin feed; it is reversible via /unhide and the
# row is never destroyed, so moderation is auditable.


@social_hub_bp.route("/posts/<post_id>/hide", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("social_hub")
@role_required("superadmin", "school_admin")
def hide_post(post_id):
    post = _get_post(post_id, include_hidden=True)
    if not post:
        return error_response("Post not found", 404)
    post.is_hidden = True
    post.hidden_by_id = g.current_user.id
    db.session.commit()
    return success_response(_post_dict(post))


@social_hub_bp.route("/posts/<post_id>/unhide", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("social_hub")
@role_required("superadmin", "school_admin")
def unhide_post(post_id):
    post = _get_post(post_id, include_hidden=True)
    if not post:
        return error_response("Post not found", 404)
    post.is_hidden = False
    post.hidden_by_id = None
    db.session.commit()
    return success_response(_post_dict(post))


@social_hub_bp.route("/posts/<post_id>/like", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("social_hub")
def toggle_like(post_id):
    post = _get_post(post_id, include_hidden=True)
    if not post:
        return error_response("Post not found", 404)
    if not _can_access_group_post(post):
        return error_response("You must be a member of this group", 403)
    user_id = str(g.current_user.id)
    # copy-on-write: mutating the loaded JSONB list in place and assigning the
    # SAME object back leaves SQLAlchemy attribute history unchanged, so every
    # unlike (and re-like after the first) silently never persisted.
    likes = list(post.likes or [])
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
    post = _get_post(post_id)
    if not post:
        return error_response("Post not found", 404)
    if not _can_access_group_post(post):
        return error_response("You must be a member of this group", 403)
    query = Comment.query.filter_by(
        school_id=g.school_id,
        post_id=post.id,
        is_deleted=False,
    ).order_by(Comment.created_at)
    items, meta = paginate(query)
    return success_response([_comment_dict(c) for c in items], meta={"pagination": meta})


@social_hub_bp.route("/posts/<post_id>/comments", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("social_hub")
def create_comment(post_id):
    post = _get_post(post_id, include_hidden=True)
    if not post:
        return error_response("Post not found", 404)
    if not _can_access_group_post(post):
        return error_response("You must be a member of this group", 403)
    data = request.get_json(silent=True) or {}
    content = (data.get("content") or "").strip()
    # E196: an empty comment is not a comment.
    if not content:
        return error_response("content is required", 400)
    comment = Comment(
        school_id=g.school_id,
        post_id=post.id,
        author_id=g.current_user.id,
        content=content,
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
    groups = []
    for grp in items:
        d = _group_dict(grp)
        # real membership, not a stale counter (E195)
        d["is_member"] = _is_group_member(grp.id, g.current_user.id)
        groups.append(d)
    return success_response(groups, meta={"pagination": meta})


@social_hub_bp.route("/groups", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("social_hub")
@role_required("superadmin", "school_admin", "teacher")
def create_group():
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    # E196: name is NOT NULL — an empty name is a 400, not a blank row.
    if not name:
        return error_response("name is required", 400)
    grp = Group(
        school_id=g.school_id,
        name=name,
        description=data.get("description", ""),
        group_type=data.get("type", "class"),
        created_by=g.current_user.id,
    )
    db.session.add(grp)
    db.session.flush()
    # the creator is the group's first member — membership is real, not a
    # counter nobody increments (E195)
    db.session.add(GroupMember(
        school_id=g.school_id,
        group_id=grp.id,
        user_id=g.current_user.id,
        role_in_group="moderator",
    ))
    _sync_member_count(grp)
    db.session.commit()
    return created_response(_group_dict(grp))


@social_hub_bp.route("/groups/<group_id>/join", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("social_hub")
def join_group(group_id):
    gid = _parse_uuid(group_id)
    group = Group.query.filter_by(
        id=gid, school_id=g.school_id, is_deleted=False
    ).first() if gid else None
    if not group:
        return error_response("Group not found", 404)
    if not _is_group_member(gid, g.current_user.id):
        db.session.add(GroupMember(
            school_id=g.school_id,
            group_id=gid,
            user_id=g.current_user.id,
        ))
        _sync_member_count(group)
        db.session.commit()
    return success_response({
        "group_id": str(gid),
        "member": True,
        "member_count": group.member_count,
    })


@social_hub_bp.route("/groups/<group_id>/leave", methods=["POST"])
@jwt_required()
@school_required
@plugin_required("social_hub")
def leave_group(group_id):
    gid = _parse_uuid(group_id)
    group = Group.query.filter_by(
        id=gid, school_id=g.school_id, is_deleted=False
    ).first() if gid else None
    if not group:
        return error_response("Group not found", 404)
    membership = GroupMember.query.filter_by(
        group_id=gid,
        user_id=g.current_user.id,
        school_id=g.school_id,
        is_deleted=False,
    ).first()
    if membership:
        membership.is_deleted = True
        _sync_member_count(group)
        db.session.commit()
    return success_response({
        "group_id": str(gid),
        "member": False,
        "member_count": group.member_count,
    })


def _post_dict(p):
    author = p.author if hasattr(p, "author") else None
    return {
        "id": str(p.id), "author_id": str(p.author_id) if p.author_id else None,
        # web feed renders the author's name next to each post
        "author_name": getattr(author, "full_name", None) if author else None,
        "author_role": getattr(author, "role", None) if author else None,
        "content": p.content,
        "post_type": p.post_type, "media_urls": p.media_urls or [],
        "likes_count": len(p.likes or []), "visibility": p.visibility,
        "group_id": str(p.group_id) if p.group_id else None,
        "is_hidden": bool(p.is_hidden),
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
        "group_type": g_obj.group_type,
        "member_count": g_obj.member_count if hasattr(g_obj, "member_count") else 0,
    }

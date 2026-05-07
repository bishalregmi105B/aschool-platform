"""Pagination utilities with offset/limit support."""
from flask import request


def paginate(query, schema=None):
    """
    Apply pagination to a SQLAlchemy query.

    Query params: ?page=1&per_page=20
    Returns: (items, meta) where meta has pagination info.
    """
    page = request.args.get("page", 1, type=int)
    per_page = min(request.args.get("per_page", 20, type=int), 100)

    pagination = query.paginate(page=page, per_page=per_page, error_out=False)

    items = pagination.items
    if schema:
        items = schema.dump(items, many=True)

    meta = {
        "page": pagination.page,
        "per_page": pagination.per_page,
        "total": pagination.total,
        "pages": pagination.pages,
        "has_next": pagination.has_next,
        "has_prev": pagination.has_prev,
    }

    return items, meta

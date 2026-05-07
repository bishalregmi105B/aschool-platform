"""Standard JSON response helpers."""
from flask import jsonify


def success_response(data=None, meta=None, status_code=200):
    """Return a successful JSON response."""
    payload = {"success": True, "data": data, "error": None, "meta": meta or {}}
    return jsonify(payload), status_code


def error_response(error, status_code=400, data=None):
    """Return an error JSON response."""
    payload = {"success": False, "data": data, "error": error, "meta": {}}
    return jsonify(payload), status_code


def created_response(data=None, meta=None):
    return success_response(data, meta, 201)


def no_content_response():
    return "", 204

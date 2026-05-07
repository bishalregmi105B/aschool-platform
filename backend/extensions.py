"""Flask extension instances — imported by app factory and models."""
import redis
from celery import Celery
from flask_caching import Cache
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_migrate import Migrate
from flask_socketio import SocketIO
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()
migrate = Migrate()
jwt = JWTManager()
cors = CORS()
limiter = Limiter(key_func=get_remote_address)
cache = Cache()
socketio = SocketIO()
celery = Celery(__name__)
redis_client = None


def init_redis(app):
	"""Initialise the shared Redis client used by background tasks and utilities."""
	global redis_client
	redis_client = redis.from_url(app.config["REDIS_URL"], decode_responses=True)
	return redis_client

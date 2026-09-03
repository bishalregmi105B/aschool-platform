"""S-07: Socket.IO handshake auth + server-side school-room scoping.

Before this, any client could connect anonymously and join any school's
room (GPS, emergency alerts, notifications were cross-tenant readable).
"""
from extensions import socketio

from tests.conftest import get_auth_headers


def _token_for(client, email, password):
    return get_auth_headers(client, email, password)["Authorization"].split(" ", 1)[1]


def _connect(app, http_client, token=None):
    return socketio.test_client(
        app,
        auth={"token": token} if token else None,
        flask_test_client=http_client,
    )


class TestSocketAuth:
    def test_unauthenticated_connect_rejected(self, app, client, school):
        c = _connect(app, client)
        assert not c.is_connected()

    def test_garbage_token_connect_rejected(self, app, client, school):
        c = _connect(app, client, token="not-a-jwt")
        assert not c.is_connected()

    def test_join_own_school_succeeds(
        self, app, client, school, admin_user
    ):
        token = _token_for(client, "admin@test.edu.np", "Test@1234")
        c = _connect(app, client, token)
        assert c.is_connected()
        ack = c.emit("join_school", {"school_id": str(school.id)}, callback=True)
        assert ack["success"] is True
        assert ack["school_id"] == str(school.id)

    def test_join_other_school_refused(
        self, app, client, school, admin_user, school_b
    ):
        """token(A) join(B) → refused: the client value is never trusted."""
        token = _token_for(client, "admin@test.edu.np", "Test@1234")
        c = _connect(app, client, token)
        ack = c.emit(
            "join_school", {"school_id": str(school_b.id)}, callback=True
        )
        assert ack["success"] is False
        assert ack["error"] == "Forbidden"

    def test_room_isolation(
        self, app, client, school, admin_user, school_b, admin_b_user
    ):
        """Events emitted for school A reach only school-A members."""
        token_a = _token_for(client, "admin@test.edu.np", "Test@1234")
        token_b = _token_for(client, "admin@schoolb.edu.np", "Test@1234")
        ca = _connect(app, client, token_a)
        cb = _connect(app, client, token_b)
        assert ca.emit(
            "join_school", {"school_id": str(school.id)}, callback=True
        )["success"]
        assert cb.emit(
            "join_school", {"school_id": str(school_b.id)}, callback=True
        )["success"]

        socketio.emit(
            "emergency_alert",
            {"message": "drill"},
            room=f"school-{school.id}",
        )

        received_a = [r["name"] for r in ca.get_received()]
        received_b = [r["name"] for r in cb.get_received()]
        assert "emergency_alert" in received_a
        assert "emergency_alert" not in received_b

    def test_superadmin_can_join_explicit_school(
        self, app, client, superadmin_user, school_b
    ):
        token = _token_for(client, "super@aschool.com.np", "SuperSecret@1")
        c = _connect(app, client, token)
        assert c.is_connected()
        ack = c.emit(
            "join_school", {"school_id": str(school_b.id)}, callback=True
        )
        assert ack["success"] is True

    def test_superadmin_without_school_id_refused(self, app, client, superadmin_user):
        token = _token_for(client, "super@aschool.com.np", "SuperSecret@1")
        c = _connect(app, client, token)
        ack = c.emit("join_school", {}, callback=True)
        assert ack["success"] is False
        assert ack["error"] == "school_id is required"

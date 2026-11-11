import json
import os
from fastapi.testclient import TestClient
from softmax_universe import RuntimeClient
from reversi_openenv.server import app


def runtime_session(session_id):
    return RuntimeClient(
        os.environ["UNIVERSE_RUNTIME_ENDPOINT"],
        os.environ["UNIVERSE_INSTALLATION_CAPABILITY"],
    ).get_session(session_id)


def assert_http_controls_absent(client):
    for method, path, body in (
        ("POST", "/reset", {"seed": 42}),
        ("POST", "/step", {"action": {"row": 2, "column": 3}}),
        ("GET", "/state", None),
    ):
        response = client.request(method, path, json=body)
        assert response.status_code == 404, (path, response.status_code, response.text)


with TestClient(app) as client:
    assert client.get("/health").status_code == 200
    assert client.get("/schema").status_code == 200
    paths = client.get("/openapi.json").json()["paths"]
    assert not {"/reset", "/step", "/state"}.intersection(paths), paths
    assert_http_controls_absent(client)
    with client.websocket_connect("/ws") as session:
        session.send_json({"type": "reset", "data": {"seed": 42}})
        reset = session.receive_json()
        assert reset["type"] == "observation", reset
        observation = reset["data"]["observation"]
        assert observation["participant_id"] == "black"
        assert reset["data"]["done"] is False
        session_id = observation["session_id"]
        before = runtime_session(session_id)
        assert all(
            player["kind"] == "bot" and player["policy"] == "external-openenv"
            for player in before["episode"]["participants"]
        )
        assert before["episode"]["decisions"] == []
        assert before["episode"]["outcome"]["kind"] == "incomplete"
        assert_http_controls_absent(client)
        assert runtime_session(session_id) == before

        with client.websocket_connect("/ws") as other:
            other.send_json({"type": "reset", "data": {"seed": 43}})
            other_reset = other.receive_json()
            assert other_reset["type"] == "observation", other_reset
            other_id = other_reset["data"]["observation"]["session_id"]
            assert other_id != session_id
            other.send_json({"type": "close"})
            assert other.receive()["type"] == "websocket.close"
        assert runtime_session(other_id)["episode"]["outcome"]["kind"] == "cancelled"
        assert runtime_session(session_id) == before

        action = observation["legal_actions"][0]
        session.send_json({"type": "step", "data": action})
        step = session.receive_json()
        assert step["type"] == "observation", step
        assert step["data"]["reward"] == 0
        session.send_json({"type": "state"})
        state = session.receive_json()
        assert state["type"] == "state", state
        assert state["data"]["step_count"] == 1
        assert state["data"]["session_id"] == session_id
        assert state["data"]["outcome"]["kind"] == "incomplete"
        stepped = runtime_session(session_id)
        assert len(stepped["episode"]["decisions"]) == 1
        assert stepped["episode"]["decisions"][0]["acceptedAction"] == action
        assert_http_controls_absent(client)
        assert runtime_session(session_id) == stepped
        session.send_json({"type": "close"})
        assert session.receive()["type"] == "websocket.close"
    closed = runtime_session(session_id)
    assert closed["episode"]["outcome"]["kind"] == "cancelled"
    assert closed["episode"]["decisions"] == stepped["episode"]["decisions"]

print(
    json.dumps(
        {
            "status": "passed",
            "http": {
                "health": 200,
                "schema": 200,
                "reset": 404,
                "step": 404,
                "state": 404,
            },
            "session_id": session_id,
            "other_session_id": other_id,
            "decisions": len(closed["episode"]["decisions"]),
            "outcome": closed["episode"]["outcome"]["kind"],
        }
    )
)
print(
    "OpenEnv native session passed: HTTP discovery and absent controls; "
    "isolated WebSocket stepping and retained close"
)

import json
import os
from threading import RLock
from typing import Any, Literal
from urllib.error import HTTPError
from urllib.parse import quote, urlsplit
from urllib.request import HTTPRedirectHandler, ProxyHandler, Request, build_opener
from uuid import uuid4

os.environ.setdefault("GRADIO_ANALYTICS_ENABLED", "False")

from openenv.core.env_server import Action, Environment, Observation, State
from pydantic import Field


class ReversiAction(Action):
    row: int = Field(strict=True, ge=0, le=7)
    column: int = Field(strict=True, ge=0, le=7)


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, request, response, code, message, headers, url):
        return None


class ReversiObservation(Observation):
    position: dict[str, Any]
    participant_id: str | None
    legal_actions: list[dict[str, Any]]
    session_id: str
    outcome: dict[str, Any]


class ReversiEnvironment(Environment[ReversiAction, ReversiObservation, State]):
    SUPPORTS_CONCURRENT_SESSIONS = True

    def __init__(
        self,
        endpoint: str | None = None,
        capability: str | None = None,
        reward_seat: Literal["black", "white"] = "black",
    ):
        super().__init__()
        self.endpoint = endpoint or os.environ["UNIVERSE_RUNTIME_ENDPOINT"]
        address = urlsplit(self.endpoint)
        if (
            address.scheme != "http"
            or address.hostname not in ("127.0.0.1", "localhost", "::1")
            or address.username is not None
            or address.password is not None
            or address.path not in ("", "/")
            or address.query
            or address.fragment
        ):
            raise ValueError("Use the explicit loopback origin of the local runtime.")
        self.endpoint = self.endpoint.rstrip("/")
        self.capability = capability or os.environ["UNIVERSE_INSTALLATION_CAPABILITY"]
        if reward_seat not in ("black", "white"):
            raise ValueError("The reward seat must be black or white.")
        self.reward_seat = reward_seat
        self._session: dict[str, Any] | None = None
        self._pending: tuple[str, dict[str, Any]] | None = None
        self._lock = RLock()
        self._http = build_opener(ProxyHandler({}), NoRedirect())

    def reset(
        self,
        seed: int | None = None,
        episode_id: str | None = None,
        **kwargs: Any,
    ) -> ReversiObservation:
        with self._lock:
            self._require_resolved()
            self.close()
            submission = episode_id or f"openenv-{uuid4()}"
            self._session = self._mutate(
                "/api/v1/sessions",
                {"submissionId": submission, "seed": 42 if seed is None else seed},
            )
            return self._observation()

    def step(
        self, action: ReversiAction, timeout_s: float | None = None, **kwargs: Any
    ) -> ReversiObservation:
        with self._lock:
            self._require_resolved()
            session = self._require_session()
            self._session = self._mutate(
                f"/api/v1/sessions/{quote(session['id'], safe='')}/steps",
                {
                    "submissionId": f"openenv-step-{uuid4()}",
                    "expectedDecisionIndex": len(session["episode"]["decisions"]),
                    "action": {"row": action.row, "column": action.column},
                },
                timeout_s,
            )
            return self._observation()

    @property
    def state(self) -> State:
        with self._lock:
            self._require_resolved()
            if self._session is None:
                return State()
            self._session = self._request(
                "GET", f"/api/v1/sessions/{quote(self._session['id'], safe='')}"
            )
            episode = self._session["episode"]
            return State(
                episode_id=episode["id"],
                step_count=len(episode["decisions"]),
                session_id=self._session["id"],
                outcome=episode["outcome"],
            )

    def reconcile(self) -> ReversiObservation:
        with self._lock:
            if self._pending is None:
                raise RuntimeError("There is no unresolved local request.")
            path, body = self._pending
            self._session = self._mutate(path, body)
            return self._observation()

    def close(self) -> None:
        with self._lock:
            self._require_resolved()
            if self._session is None:
                return
            session = self._session
            self._session = self._mutate(
                f"/api/v1/sessions/{quote(session['id'], safe='')}/close",
                {"submissionId": f"openenv-close-{uuid4()}"},
            )

    def _mutate(
        self, path: str, body: dict[str, Any], timeout_s: float | None = None
    ) -> dict[str, Any]:
        self._pending = (path, body)
        try:
            response = self._request("POST", path, body, timeout_s)
        except HTTPError as error:
            if error.code < 500:
                self._pending = None
            raise
        self._pending = None
        return response

    def _request(
        self,
        method: str,
        path: str,
        body: dict[str, Any] | None = None,
        timeout_s: float | None = None,
    ) -> dict[str, Any]:
        headers = {
            "Authorization": f"Bearer {self.capability}",
            "Origin": self.endpoint,
            "x-universe-request-id": body["submissionId"] if body else str(uuid4()),
        }
        payload = None
        if body is not None:
            headers["Content-Type"] = "application/json"
            payload = json.dumps(body).encode()
        request = Request(self.endpoint + path, data=payload, headers=headers, method=method)
        with self._http.open(request, timeout=timeout_s or 30) as response:
            value = json.load(response)
        if (
            not isinstance(value, dict)
            or not isinstance(value.get("id"), str)
            or not isinstance(value.get("episode"), dict)
            or not isinstance(value["episode"].get("decisions"), list)
            or not isinstance(value["episode"].get("outcome"), dict)
            or "turn" not in value
        ):
            raise ValueError("The local runtime returned an invalid session receipt.")
        if path == "/api/v1/sessions":
            if value.get("submissionId") != body["submissionId"]:
                raise ValueError("The runtime returned a different session submission.")
        elif self._session is not None and value["id"] != self._session["id"]:
            raise ValueError("The runtime returned a different session.")
        return value

    def _require_resolved(self) -> None:
        if self._pending is not None:
            raise RuntimeError("The last request has an unknown result. Call reconcile() before new work.")

    def _require_session(self) -> dict[str, Any]:
        if self._session is None:
            raise RuntimeError("Reset the environment before stepping.")
        return self._session

    def _observation(self) -> ReversiObservation:
        session = self._require_session()
        episode = session["episode"]
        turn = session["turn"]
        outcome = episode["outcome"]
        done = outcome["kind"] != "incomplete" or turn is None
        reward = None
        if outcome["kind"] == "terminated":
            reward = outcome["scores"][self.reward_seat]
        if turn is None:
            decisions = episode["decisions"]
            position = decisions[-1]["nextObservation"] if decisions else {}
            participant = None
            legal_actions = []
        else:
            position = turn["observation"]
            participant = turn["participantId"]
            legal_actions = turn["legalActions"]
        return ReversiObservation(
            position=position,
            participant_id=participant,
            legal_actions=legal_actions,
            session_id=session["id"],
            outcome=outcome,
            done=done,
            reward=reward,
        )

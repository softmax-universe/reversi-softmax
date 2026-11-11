import os
from copy import deepcopy
from threading import RLock
from typing import Any, Literal

os.environ.setdefault("GRADIO_ANALYTICS_ENABLED", "False")

from openenv.core.env_server import Action, Environment, Observation, State
from pydantic import Field
from softmax_universe import RuntimeClient, UncertainMutation


class ReversiAction(Action):
    row: int = Field(strict=True, ge=0, le=7)
    column: int = Field(strict=True, ge=0, le=7)


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
        controllers: dict | None = None,
    ):
        super().__init__()
        self.client = RuntimeClient(
            endpoint or os.environ["UNIVERSE_RUNTIME_ENDPOINT"],
            capability or os.environ["UNIVERSE_INSTALLATION_CAPABILITY"],
        )
        if reward_seat not in ("black", "white"):
            raise ValueError("The reward seat must be black or white.")
        self.reward_seat = reward_seat
        self._controllers = (
            deepcopy(controllers)
            if controllers is not None
            else {
                agent: {"kind": "bot", "policy": "external-openenv"}
                for agent in ("black", "white")
            }
        )
        self._session = None
        self._pending = None
        self._lock = RLock()

    def _mutate(self, operation):
        try:
            self._session = operation()
            self._pending = None
        except UncertainMutation as error:
            self._pending = error.command
            raise

    def reset(
        self, seed: int | None = None, episode_id: str | None = None, **kwargs: Any
    ):
        with self._lock:
            self._require_resolved()
            if self._session is not None:
                self.close()
            self._mutate(
                lambda: self.client.create_session(
                    seed=0 if seed is None else seed,
                    submission_id=episode_id,
                    configuration={"controllers": self._controllers},
                )
            )
            return self._observation()

    def step(
        self, action: ReversiAction, timeout_s: float | None = None, **kwargs: Any
    ):
        with self._lock:
            self._require_resolved()
            session = self._require_session()
            if session["frame"] is None:
                raise RuntimeError("The episode has ended.")
            agent = next(iter(session["frame"]["requests"]))
            self._mutate(
                lambda: self.client.step_session(
                    session["id"],
                    actions={agent: {"row": action.row, "column": action.column}},
                    expected_frame_index=len(session["episode"]["frames"]),
                    timeout=timeout_s,
                )
            )
            return self._observation()

    @property
    def state(self):
        with self._lock:
            self._require_resolved()
            if self._session is None:
                return State()
            self._session = self.client.get_session(self._session["id"])
            episode = self._session["episode"]
            return State(
                episode_id=episode["id"],
                step_count=len(episode["frames"]),
                session_id=self._session["id"],
                outcome=episode["outcome"],
            )

    def reconcile(self):
        with self._lock:
            if self._pending is None:
                raise RuntimeError("There is no unresolved request.")
            self._mutate(lambda: self.client.reconcile(self._pending))
            return self._observation()

    def close(self):
        with self._lock:
            self._require_resolved()
            if self._session is not None:
                session_id = self._session["id"]
                self._mutate(lambda: self.client.close_session(session_id))

    def _require_resolved(self):
        if self._pending is not None:
            raise RuntimeError("Reconcile the original command before new work.")

    def _require_session(self):
        if self._session is None:
            raise RuntimeError("Reset the environment before stepping.")
        return self._session

    def _observation(self):
        session = self._require_session()
        episode = session["episode"]
        frame = session["frame"]
        outcome = episode["outcome"]
        if frame is None:
            position = (
                episode["frames"][-1]["observations"][self.reward_seat]
                if episode["frames"]
                else {}
            )
            participant, legal_actions = None, []
        else:
            participant, request = next(iter(frame["requests"].items()))
            position = request["observation"]
            legal_actions = request["actionSpace"]["actions"]
        reward = None
        if episode["frames"] and outcome["kind"] in (
            "incomplete",
            "terminated",
            "truncated",
        ):
            reward = episode["frames"][-1]["rewards"][self.reward_seat]
        return ReversiObservation(
            position=position,
            participant_id=participant,
            legal_actions=legal_actions,
            session_id=session["id"],
            outcome=outcome,
            done=frame is None,
            reward=reward,
        )

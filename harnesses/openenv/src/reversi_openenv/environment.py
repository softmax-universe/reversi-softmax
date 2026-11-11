import os
from copy import deepcopy
from threading import RLock
from typing import Any, Literal

os.environ.setdefault("GRADIO_ANALYTICS_ENABLED", "False")

from openenv.core.env_server import Action, Environment, Observation, State
from pydantic import Field
from softmax_universe import RuntimeClient


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
        self.session = self.client.session()
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
        self._lock = RLock()

    def reset(
        self, seed: int | None = None, episode_id: str | None = None, **kwargs: Any
    ):
        with self._lock:
            state = self.session.reset(
                seed=0 if seed is None else seed,
                submission_id=episode_id,
                configuration={"controllers": self._controllers},
            )
            return self._observation(state)

    def step(
        self, action: ReversiAction, timeout_s: float | None = None, **kwargs: Any
    ):
        with self._lock:
            state = self.session.state
            if state is None or state["frame"] is None:
                raise RuntimeError("Reset the environment before stepping.")
            agent = next(iter(state["frame"]["requests"]))
            state = self.session.step(
                {agent: {"row": action.row, "column": action.column}},
                timeout=timeout_s,
            )
            return self._observation(state)

    @property
    def state(self):
        with self._lock:
            state = self.session.refresh()
            if state is None:
                return State()
            return State(
                episode_id=state["episodeId"],
                step_count=state["decisionCount"],
                session_id=state["id"],
                outcome=state["outcome"],
            )

    def reconcile(self):
        with self._lock:
            return self._observation(self.session.reconcile())

    def close(self):
        with self._lock:
            self.session.close()

    def _observation(self, state):
        frame = state["frame"]
        transition = state["transition"]
        outcome = state["outcome"]
        if frame is None:
            position = (
                transition["observations"][self.reward_seat] if transition else {}
            )
            participant, legal_actions = None, []
        else:
            participant, request = next(iter(frame["requests"].items()))
            position = request["observation"]
            legal_actions = request["actionSpace"]["actions"]
        reward = None
        if transition and outcome["kind"] in ("incomplete", "terminated", "truncated"):
            reward = transition["rewards"][self.reward_seat]
        return ReversiObservation(
            position=position,
            participant_id=participant,
            legal_actions=legal_actions,
            session_id=state["id"],
            outcome=outcome,
            done=frame is None,
            reward=reward,
        )

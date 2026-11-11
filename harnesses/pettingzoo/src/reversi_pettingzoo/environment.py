import os
from copy import deepcopy

import numpy as np
from gymnasium import spaces
from pettingzoo import AECEnv
from softmax_universe import RuntimeClient, UncertainMutation


class ReversiEnvironment(AECEnv):
    metadata = {
        "name": "reversi_softmax_v1",
        "render_modes": ["ansi"],
        "is_parallelizable": False,
    }

    def __init__(
        self, endpoint=None, capability=None, render_mode=None, controllers=None
    ):
        self.client = RuntimeClient(
            endpoint or os.environ["UNIVERSE_RUNTIME_ENDPOINT"],
            capability or os.environ["UNIVERSE_INSTALLATION_CAPABILITY"],
        )
        self.possible_agents = ["black", "white"]
        self._controllers = (
            deepcopy(controllers)
            if controllers is not None
            else {
                agent: {"kind": "bot", "policy": "external-pettingzoo"}
                for agent in self.possible_agents
            }
        )
        self.render_mode = render_mode
        self.agents = []
        self._session = None
        self._pending = None
        self._positions = {}
        self._action_spaces = {
            agent: spaces.Discrete(64) for agent in self.possible_agents
        }
        self._observation_spaces = {
            agent: spaces.Dict(
                {
                    "observation": spaces.Box(-1, 1, shape=(8, 8), dtype=np.int8),
                    "action_mask": spaces.MultiBinary(64),
                }
            )
            for agent in self.possible_agents
        }

    def action_space(self, agent):
        return self._action_spaces[agent]

    def observation_space(self, agent):
        return self._observation_spaces[agent]

    def reset(self, seed=None, options=None):
        self._require_resolved()
        self.close()
        self._mutate(
            lambda: self.client.create_session(
                seed=0 if seed is None else seed,
                configuration={"controllers": self._controllers},
            )
        )
        self._start_episode()

    def _start_episode(self):
        self.agents = self.possible_agents[:]
        self.rewards = {agent: 0 for agent in self.agents}
        self._cumulative_rewards = dict(self.rewards)
        self.terminations = {agent: False for agent in self.agents}
        self.truncations = {agent: False for agent in self.agents}
        self.infos = {
            agent: {"session_id": self._session["id"]} for agent in self.agents
        }
        self._skip_agent_selection = None
        self._synchronize()

    def observe(self, agent):
        position = self._positions[agent]
        board = np.asarray(
            [
                [0 if piece is None else 1 if piece == agent else -1 for piece in row]
                for row in position["board"]
            ],
            dtype=np.int8,
        )
        mask = np.zeros(64, dtype=np.int8)
        request = (
            self._session["frame"]["requests"].get(agent)
            if self._session["frame"]
            else None
        )
        if request:
            for action in request["actionSpace"]["actions"]:
                mask[action["row"] * 8 + action["column"]] = 1
        return {"observation": board, "action_mask": mask}

    def step(self, action):
        self._require_resolved()
        agent = self.agent_selection
        if self.terminations[agent] or self.truncations[agent]:
            return self._was_dead_step(action)
        if (
            not self.action_space(agent).contains(action)
            or not self.observe(agent)["action_mask"][action]
        ):
            raise ValueError("Choose an available board square.")
        self._cumulative_rewards[agent] = 0
        self._mutate(
            lambda: self.client.step_session(
                self._session["id"],
                actions={agent: {"row": int(action) // 8, "column": int(action) % 8}},
                expected_frame_index=len(self._session["episode"]["frames"]),
            )
        )
        self._synchronize()
        self._accumulate_rewards()

    def reconcile(self):
        if self._pending is None:
            raise RuntimeError("There is no unresolved command.")
        operation = self._pending.operation
        self._mutate(lambda: self.client.reconcile(self._pending))
        if operation == "close":
            self._session = None
            self.agents = []
        elif operation == "create":
            self._start_episode()
        else:
            self._synchronize()
            self._accumulate_rewards()

    def close(self):
        self._require_resolved()
        if (
            self._session is not None
            and self._session["episode"]["outcome"]["kind"] == "incomplete"
        ):
            self._mutate(lambda: self.client.close_session(self._session["id"]))
        self._session = None
        self.agents = []

    def render(self):
        if not self._positions:
            return ""
        return "\n".join(
            "".join(
                "." if piece is None else "X" if piece == "black" else "O"
                for piece in row
            )
            for row in self._positions["black"]["board"]
        )

    def _mutate(self, operation):
        try:
            self._session = operation()
            self._pending = None
        except UncertainMutation as error:
            self._pending = error.command
            raise

    def _require_resolved(self):
        if self._pending is not None:
            raise RuntimeError("Reconcile the original command before new work.")

    def _synchronize(self):
        episode = self._session["episode"]
        frame = self._session["frame"]
        self._clear_rewards()
        if episode["frames"]:
            transition = episode["frames"][-1]
            self._positions = transition["observations"]
            self.rewards.update(transition["rewards"])
        elif frame:
            position = next(iter(frame["requests"].values()))["observation"]
            self._positions = {agent: position for agent in self.possible_agents}
        outcome = episode["outcome"]["kind"]
        if outcome not in ("incomplete", "terminated", "truncated"):
            raise RuntimeError("The runtime ended without a game result: " + outcome)
        if frame:
            self.agent_selection = next(iter(frame["requests"]))
        else:
            self.terminations = {
                agent: outcome == "terminated" for agent in self.agents
            }
            self.truncations = {agent: outcome == "truncated" for agent in self.agents}
            self.agent_selection = self.agents[0]
            self._deads_step_first()

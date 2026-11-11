import json

import numpy as np
from pettingzoo.test import api_test

from reversi_pettingzoo import ReversiEnvironment


environment = ReversiEnvironment()
try:
    api_test(environment, num_cycles=100)
    environment.reset(seed=42)
    session_id = environment.session.state["id"]
    for agent in environment.agent_iter(200):
        observation, reward, terminated, truncated, _ = environment.last()
        action = (
            None
            if terminated or truncated
            else int(np.flatnonzero(observation["action_mask"])[0])
        )
        environment.step(action)
    retained = {"episode": environment.client.get_recording(session_id)["episodes"][0]}
    assert retained["episode"]["outcome"]["kind"] == "terminated"
    assert all(
        player["kind"] == "bot" and player["policy"] == "external-pettingzoo"
        for player in retained["episode"]["participants"]
    )
    assert 0 < len(retained["episode"]["frames"]) <= 60
    print(
        json.dumps(
            {
                "status": "passed",
                "session_id": session_id,
                "outcome": retained["episode"]["outcome"],
                "frames": len(retained["episode"]["frames"]),
            }
        )
    )
finally:
    environment.close()

print("PettingZoo native session passed")

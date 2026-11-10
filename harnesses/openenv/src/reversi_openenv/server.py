from openenv.core.env_server import State, create_app

from .environment import ReversiAction, ReversiEnvironment, ReversiObservation

app = create_app(
    ReversiEnvironment,
    ReversiAction,
    ReversiObservation,
    env_name="reversi_softmax",
    state_cls=State,
    max_concurrent_envs=8,
    mode="production",
)


def main():
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=8000)

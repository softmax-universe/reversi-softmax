ARG BASE_IMAGE
FROM ${BASE_IMAGE}
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates procps libstdc++6 tini && rm -rf /var/lib/apt/lists/*
RUN groupadd --gid 10001 reversi && useradd --uid 10001 --gid 10001 --no-create-home reversi
COPY application/ /opt/reversi/
RUN mkdir -p /var/lib/reversi /workspace /logs/verifier && chown 10001:10001 /var/lib/reversi /workspace /logs/verifier && chmod 700 /var/lib/reversi
USER 10001:10001
WORKDIR /workspace
ENTRYPOINT ["/usr/bin/tini", "--", "/opt/reversi/universe-local", "start", "--release", "/opt/reversi/release.json", "--state", "/var/lib/reversi/runtime", "--port", "4328"]

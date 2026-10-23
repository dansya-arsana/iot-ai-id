# Pro lint sandbox for Python / MicroPython (plan §7 M3-E). Static checks only, never executes user code.
#   docker build -f scripts/pro-sandbox/Dockerfile.py -t aiot-pro-py:1 scripts/pro-sandbox
FROM python:3.12-alpine
COPY lint.py /opt/lint.py
RUN chmod 0444 /opt/lint.py
USER 65534:65534
WORKDIR /work

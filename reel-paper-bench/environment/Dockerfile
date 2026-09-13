# Do not change this to a public image. Harbor only accepts the org's prebuilt
# base images; ubuntu, node and mcr.microsoft.com/playwright are all rejected
# with "base image not allowlisted: <image>; Dockerfile has no FROM instruction".
# app-base:latest already provides Node, Python, Playwright and Chromium.
FROM app-base:latest

ARG APP_NAME=app
ENV APP_NAME=${APP_NAME}

ENV DANGEROUSLY_DISABLE_HOST_CHECK=true

COPY ${APP_NAME}/backend/package*.json   /app/${APP_NAME}/backend/
COPY ${APP_NAME}/frontend/package*.json  /app/${APP_NAME}/frontend/
RUN npm --prefix /app/${APP_NAME}/backend  install --no-audit --no-fund \
 && npm --prefix /app/${APP_NAME}/frontend install --no-audit --no-fund

COPY ${APP_NAME} /app/${APP_NAME}

COPY problem_assets /app/problem_assets

WORKDIR /app/${APP_NAME}
CMD ["bash"]

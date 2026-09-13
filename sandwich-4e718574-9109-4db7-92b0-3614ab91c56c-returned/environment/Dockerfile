FROM us-docker.pkg.dev/afterquery-compute/compute-images/sand-app-base@sha256:dc40aeb1d0c0842f7d13f2b73fa2901c997171d13db704d2d36d0830ada3fe13
ARG APP_NAME=app
ENV APP_NAME=${APP_NAME}
ENV DANGEROUSLY_DISABLE_HOST_CHECK=true
COPY ${APP_NAME}/backend/package*.json /app/${APP_NAME}/backend/
COPY ${APP_NAME}/frontend/package*.json /app/${APP_NAME}/frontend/
RUN npm --prefix /app/${APP_NAME}/backend install --no-audit --no-fund && npm --prefix /app/${APP_NAME}/frontend install --no-audit --no-fund
COPY ${APP_NAME} /app/${APP_NAME}
COPY problem_assets /app/problem_assets
WORKDIR /app/${APP_NAME}
CMD ["bash"]

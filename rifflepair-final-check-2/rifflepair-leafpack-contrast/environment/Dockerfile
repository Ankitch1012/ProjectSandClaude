# Harbor requires the organization's prebuilt application image.
FROM app-base:latest

ARG APP_NAME=app
ENV APP_NAME=${APP_NAME}
ENV PYTHONDONTWRITEBYTECODE=1

COPY ${APP_NAME} /app/${APP_NAME}
COPY problem_assets /app/problem_assets

WORKDIR /app/${APP_NAME}
CMD ["bash"]

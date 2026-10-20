# Minimal image for running sn-lint in CI systems that prefer containers.
#   docker build -t sn-lint .
#   docker run --rm -v "$PWD:/work" sn-lint examples/ --format sarif -o reports/sn-lint.sarif
FROM node:20-alpine

LABEL org.opencontainers.image.title="servicenow-update-set-linter" \
      org.opencontainers.image.description="Static analysis for exported ServiceNow update sets" \
      org.opencontainers.image.licenses="MIT" \
      org.opencontainers.image.source="https://github.com/akramservicenow-sketch/servicenow-update-set-linter"

WORKDIR /opt/sn-lint
COPY package.json README.md LICENSE ./
COPY bin ./bin
COPY src ./src

# No npm install needed: the tool has zero dependencies.
RUN chmod +x bin/sn-lint.js && ln -s /opt/sn-lint/bin/sn-lint.js /usr/local/bin/sn-lint

# Run as the unprivileged user shipped with the node image.
USER node
WORKDIR /work
ENTRYPOINT ["sn-lint"]
CMD ["--help"]

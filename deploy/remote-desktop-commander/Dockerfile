# Reuse a verified local Debian/Python base when Docker Hub is unreachable.
ARG BASE_IMAGE=dingdong-backend:0.3.26
FROM ${BASE_IMAGE}
USER root
HEALTHCHECK NONE
RUN /usr/local/bin/python3 -c "import shutil; shutil.rmtree('/app')"
ENV PATH=/usr/local/bin:/usr/bin:/bin HOME=/state SHELL=/bin/sh \
    DESKTOP_COMMANDER_DISABLE_TELEMETRY=1 PUPPETEER_SKIP_DOWNLOAD=true
WORKDIR /opt/agent
ARG APT_HTTPS_PROXY=
COPY node-runtime/ /usr/local/
RUN /usr/local/bin/python3 -c "from pathlib import Path; p=Path('/etc/apt/sources.list.d/debian.sources'); p.write_text(p.read_text().replace('http://deb.debian.org','https://deb.debian.org'))" \
    && apt-get -o Acquire::https::Proxy=${APT_HTTPS_PROXY:-DIRECT} -o Acquire::https::Timeout=30 -o Acquire::Retries=2 update \
    && apt-get -o Acquire::https::Proxy=${APT_HTTPS_PROXY:-DIRECT} -o Acquire::https::Timeout=30 -o Acquire::Retries=2 install -y --no-install-recommends procps ripgrep chromium
COPY package.json package-lock.json ./
RUN ln -sf ../lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm \
    && ln -sf ../lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx \
    && npm ci --ignore-scripts --omit=dev --no-audit --no-fund --registry=https://registry.npmjs.org \
    && node node_modules/@wonderwhy-er/desktop-commander/dist/npm-scripts/verify-ripgrep.js
COPY verify-tools.mjs boundary-test.py /opt/agent/
RUN /usr/local/bin/python3 -c "import shutil; shutil.rmtree('/app', ignore_errors=True)"
USER 10001:10001
WORKDIR /workspace
ENTRYPOINT ["/usr/local/bin/node", "/opt/agent/node_modules/@wonderwhy-er/desktop-commander/dist/index.js"]
CMD ["remote", "--disable-no-sleep"]

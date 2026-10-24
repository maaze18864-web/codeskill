FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-venv ca-certificates openjdk-17-jdk-headless maven && rm -rf /var/lib/apt/lists/*
WORKDIR /opt/runtime
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force
COPY requirements.txt requirements.lock ./
RUN python3 -m venv /opt/venv && /opt/venv/bin/pip install --no-cache-dir --upgrade pip==26.2.2 setuptools==84.2.1 && /opt/venv/bin/pip install --no-cache-dir -r requirements.lock
COPY spring/ /opt/spring-template/
RUN mvn -B -f /opt/spring-template/pom.xml -Dmaven.repo.local=/opt/m2 -DskipTests dependency:go-offline package && rm -rf /opt/spring-template/target
RUN apt-get update && apt-get install -y --no-install-recommends bash coreutils findutils grep sed gawk procps curl git less nano tree unzip zip ncurses-bin && rm -rf /var/lib/apt/lists/*
COPY bridge.mjs workspace-files.mjs frontend.mjs next-server.mjs ws-tunnel.mjs terminal.py ./
ENV PATH="/opt/venv/bin:${PATH}" HOME=/tmp PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 NODE_ENV=development
USER 1000:1000
WORKDIR /work
CMD ["node", "-e", "setInterval(() => {}, 60000)"]

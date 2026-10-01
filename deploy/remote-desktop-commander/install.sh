#!/bin/sh
set -eu
rdc_root=/opt/remote-desktop-commander
cd "$rdc_root/install"
[ ! -e /etc/systemd/system/remote-desktop-commander.service ]
[ ! -e "$rdc_root/state/.desktop-commander-device/device.json" ]
if [ ! -d build/node-runtime ]; then tar -xzf build-context.tar.gz; fi
rdc_base=$(docker image inspect dingdong-backend:0.3.26 --format '{{.Id}}')
printf '%s\n' "$rdc_base" > base-image-id.txt
DOCKER_BUILDKIT=0 docker build --network="${RDC_BUILD_NETWORK:-default}" --build-arg APT_HTTPS_PROXY="${RDC_APT_PROXY:-}" --memory=1g --cpu-quota=50000 --build-arg BASE_IMAGE="$rdc_base" -t dingdong-rdc:0.2.52 build
if ! getent passwd rdc-status >/dev/null; then useradd --system --no-create-home --home-dir /nonexistent --shell /usr/sbin/nologin rdc-status; fi
chown rdc-status:rdc-status "$rdc_root/host-status"
install -m 0600 -o 10001 -g 10001 config.json "$rdc_root/state/.claude-server-commander/config.json"
install -m 0644 rdc-host-status.service rdc-host-status.timer remote-desktop-commander.service /etc/systemd/system/
systemd-analyze verify /etc/systemd/system/rdc-host-status.service /etc/systemd/system/remote-desktop-commander.service
systemctl daemon-reload
systemctl start rdc-host-status.service
systemctl enable --now rdc-host-status.timer
docker create --name remote-desktop-commander --hostname dingdong-prod-restricted \
  --user 10001:10001 --read-only --cap-drop ALL --security-opt no-new-privileges=true \
  --memory 512m --memory-swap 512m --cpus 0.5 --pids-limit 128 \
  --network bridge --init --log-driver local --log-opt max-size=5m --log-opt max-file=2 \
  --mount type=bind,src="$rdc_root/workspace",dst=/workspace \
  --mount type=bind,src="$rdc_root/state",dst=/state \
  --mount type=bind,src="$rdc_root/host-status",dst=/host-status,readonly \
  --tmpfs /tmp:rw,noexec,nosuid,nodev,size=64m,mode=1777 \
  --workdir /workspace dingdong-rdc:0.2.52
# Tool verification uses the same immutable image and restricted mounts before pairing.
docker run --rm --user 10001:10001 --read-only --cap-drop ALL \
  --security-opt no-new-privileges=true --memory 512m --memory-swap 512m --cpus 0.5 --pids-limit 128 \
  --network bridge --init \
  --mount type=bind,src="$rdc_root/workspace",dst=/workspace \
  --mount type=bind,src="$rdc_root/state",dst=/state \
  --mount type=bind,src="$rdc_root/host-status",dst=/host-status,readonly \
  --tmpfs /tmp:rw,noexec,nosuid,nodev,size=64m,mode=1777 \
  --entrypoint /usr/local/bin/node dingdong-rdc:0.2.52 /opt/agent/verify-tools.mjs \
  > "$rdc_root/install/tool-verification.json"
cat "$rdc_root/install/tool-verification.json"
systemctl enable --now remote-desktop-commander.service
printf 'INSTALL_STARTED_PAIRING_PENDING\n'

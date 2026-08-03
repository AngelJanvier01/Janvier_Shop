#!/usr/bin/env bash

set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Ejecuta este script con sudo." >&2
  exit 1
fi

operator_user="${1:-}"
if [[ -n "${operator_user}" ]] && ! id "${operator_user}" >/dev/null 2>&1; then
  echo "El usuario operador no existe: ${operator_user}" >&2
  exit 1
fi

source /etc/os-release
if [[ "${ID:-}" != "ubuntu" ]]; then
  echo "Este aprovisionamiento sólo admite Ubuntu; se detectó ${ID:-desconocido}." >&2
  exit 1
fi

architecture="$(dpkg --print-architecture)"
codename="${UBUNTU_CODENAME:-${VERSION_CODENAME:-}}"
if [[ -z "${codename}" ]]; then
  echo "No se pudo determinar el nombre de la versión de Ubuntu." >&2
  exit 1
fi

conflicting_packages=(
  docker.io
  docker-compose
  docker-compose-v2
  docker-doc
  podman-docker
  containerd
  runc
)
installed_conflicts=()
for package in "${conflicting_packages[@]}"; do
  if dpkg-query -W -f='${db:Status-Abbrev}' "${package}" 2>/dev/null | grep -q '^ii'; then
    installed_conflicts+=("${package}")
  fi
done
if (( ${#installed_conflicts[@]} > 0 )); then
  printf 'Hay paquetes que entran en conflicto con Docker CE: %s\n' \
    "${installed_conflicts[*]}" >&2
  echo "Retíralos conscientemente antes de continuar; el script no los desinstala." >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive

ubuntu_sources=/etc/apt/sources.list.d/ubuntu.sources
if ! grep -Eq '^Components:.*\bmain\b.*\buniverse\b' "${ubuntu_sources}" 2>/dev/null; then
  if [[ -f "${ubuntu_sources}" ]]; then
    install -m 0700 -d /var/backups/janvier
    cp -a "${ubuntu_sources}" \
      "/var/backups/janvier/ubuntu.sources.pre-janvier-$(date -u +%Y%m%dT%H%M%SZ)"
  fi
  tee "${ubuntu_sources}" >/dev/null <<EOF
Types: deb
URIs: http://archive.ubuntu.com/ubuntu/
Suites: ${codename} ${codename}-updates ${codename}-backports
Components: main universe restricted multiverse
Signed-By: /usr/share/keyrings/ubuntu-archive-keyring.gpg

Types: deb
URIs: http://security.ubuntu.com/ubuntu/
Suites: ${codename}-security
Components: main universe restricted multiverse
Signed-By: /usr/share/keyrings/ubuntu-archive-keyring.gpg
EOF
  echo "Se restauraron las fuentes oficiales completas de Ubuntu."
fi

apt-get update
apt-get install -y ca-certificates curl age dnsutils git jq

install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc

tee /etc/apt/sources.list.d/docker.sources >/dev/null <<EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: ${codename}
Components: stable
Architectures: ${architecture}
Signed-By: /etc/apt/keyrings/docker.asc
EOF

install -m 0755 -d /usr/share/keyrings
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg \
  -o /usr/share/keyrings/cloudflare-main.gpg
tee /etc/apt/sources.list.d/cloudflared.list >/dev/null <<'EOF'
deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared any main
EOF

apt-get update
apt-get install -y \
  cloudflared \
  containerd.io \
  docker-buildx-plugin \
  docker-ce \
  docker-ce-cli \
  docker-compose-plugin

systemctl enable --now docker
docker version
docker compose version
cloudflared --version
age --version

if [[ -n "${operator_user}" ]]; then
  usermod -aG docker "${operator_user}"
  echo "Se agregó ${operator_user} al grupo docker; la membresía aplica en su próxima sesión."
fi

echo "Host aprovisionado. El firewall y el túnel se configuran por separado."

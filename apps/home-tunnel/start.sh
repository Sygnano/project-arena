#!/bin/sh
# Joins the tailnet as an ephemeral node tagged tag:railway, then forwards each port in
# FORWARD_PORTS from Railway's private network to the same port on TARGET_HOST. The tailnet
# policy lets tag:railway reach only those ports on the home PC.
set -eu

: "${TS_AUTHKEY:?TS_AUTHKEY (the Tailscale OAuth client secret, tskey-client-...) is required}"
TARGET_HOST="${TARGET_HOST:-100.91.106.50}"
FORWARD_PORTS="${FORWARD_PORTS:-5432 3002}"
SOCKET=/tmp/tailscaled.sock
# Full-size WireGuard packets between the PC and Railway are dropped somewhere on the path: a
# reply over one packet stalled ~7.5 s until Windows fell back to 536-byte segments. A smaller
# MTU here makes this end advertise a TCP MSS whose packets fit, WireGuard overhead included.
export TS_DEBUG_MTU="${TS_DEBUG_MTU:-1200}"

# Userspace networking: Railway containers have no TUN device. No state kept: each deploy joins
# as a new ephemeral node, and Tailscale removes the old one once it goes offline.
tailscaled --tun=userspace-networking --state=mem: --socket="$SOCKET" &
TAILSCALED=$!

# An OAuth client secret registers the node itself; it must carry the client's tag.
tailscale --socket="$SOCKET" up \
  --auth-key="${TS_AUTHKEY}?ephemeral=true&preauthorized=true" \
  --advertise-tags=tag:railway \
  --hostname="${RAILWAY_SERVICE_NAME:-home-tunnel}-${RAILWAY_ENVIRONMENT_NAME:-local}" \
  --accept-dns=false

for port in $FORWARD_PORTS; do
  # "::" with ipv6only=0 takes IPv6 and IPv4: Railway's private network can be IPv6-only.
  socat "TCP6-LISTEN:${port},ipv6only=0,reuseaddr,fork" \
    EXEC:"tailscale --socket=$SOCKET nc $TARGET_HOST $port" &
  echo "forwarding :$port -> $TARGET_HOST:$port"
done

# tailscaled exiting ends the container, and Railway restarts it. (The socat listeners only
# exit with the container: each connection runs in its own fork.)
wait "$TAILSCALED"
exit 1

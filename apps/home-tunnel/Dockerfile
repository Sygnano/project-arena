# Railway's way to the home PC (see README.md): joins the tailnet and forwards ports on Railway's
# private network to the PC. The official image ships tailscaled and the CLI; socat listens.
FROM tailscale/tailscale:v1.102.5

RUN apk add --no-cache socat

COPY start.sh /start.sh
RUN chmod +x /start.sh

ENTRYPOINT ["/start.sh"]

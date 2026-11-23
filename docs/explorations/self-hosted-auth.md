# Self-hosted auth

A lock for Bica's socket that doesn't depend on the network. None is built. Today the network is the lock: the server listens on localhost, and the phone reaches it through `tailscale serve` ([deploy.md](../deploy.md)). Anyone who reaches the socket has a shell on the machine.

## What protects it today

The socket accepts a handshake when the `Origin` host equals the `Host` header, and the socket and the diff blobs refuse a `Host` that isn't localhost, an IP address, or `.ts.net` ([deploy.md](../deploy.md)). Downloads and prompt images need no check: their URLs hold a random token or a hash of the bytes, which a page can't guess. The `Host` check stops DNS rebinding, where a page on `evil.example` points its own name at `127.0.0.1` so both headers say `evil.example`. Transmission had a code execution bug of exactly this kind in 2018. Anyone on the network Bica is served to still gets in, which is what the token is for.

## The design: one token, a pairing link, a cookie

Jupyter's model, which has protected a code-running server without accounts for years, with T3 Code's pairing link.

- On first start, the server writes a random token to the data folder, readable only by the owner, unless `BICA_TOKEN` is set.
- It prints a link with the token in the hash (`/#token=…`), so proxies never log it. The page trades it for a long-lived `HttpOnly` cookie with a name of its own, `bica_token`, and clears the hash. Only the socket handshake checks the cookie, compared with `crypto.timingSafeEqual`. The app shell stays public.
- When the socket is refused, the app shows a paste box in place, with no redirect, since a redirect can throw an installed iOS app out to Safari.
- A "Pair a phone" QR code in Settings, built from `location.origin`, which is already the right address.
- Reset: delete the token file and restart, which logs out every device.
- `BICA_AUTH=off` for setups that already have a login (Tailscale, Cloudflare Access). The `Host` allowlist stays on, and binding beyond loopback with auth off prints a warning.

A random token needs no rate limiter and has no first-visit race, where whoever loads the page first owns the install (Portainer, AdGuard Home).

## Pitfalls

- Don't skip auth for requests from `127.0.0.1` or with `Host: localhost`. Every reverse proxy on the machine, `tailscale serve` included, connects from loopback, and nginx rewrites `Host`.
- Browsers send cookies on cross-site WebSocket handshakes, so the `Origin` check stays.
- Any new HTTP route that changes state, such as a login endpoint, checks `Origin` too.
- Cookies ignore ports, so the dev and built servers share one, and so would other tools on the host without a unique name.
- On iOS, a home screen app has its own cookie jar. Safari copies cookies into it only when the app is added, so pair in Safari first, then add to the home screen. The paste box covers the rest.
- Whether iOS keeps a cookie set on the WebSocket's 101 response needs a test. If not, a small `POST /auth` route does the job.

## Not taken

- A password you choose: weak passwords need a rate limiter, and it means typing on the phone.
- One session per device with revoke (T3 Code): a session store and a management page, a lot for two or three devices.
- HTTP basic auth (OpenCode): breaks installed apps, has no logout, and isn't reliably sent on WebSocket handshakes.

## Sources

- Jupyter's token auth and `allow_remote_access` host check.
- code-server's generated password, and CVE-2023-26114, a missing `Origin` check on its socket.
- T3 Code's `t3 serve` pairing link and QR code: https://github.com/pingdotgg/t3code
- OpenCode reverting a password generated on every start, because it broke users behind Cloudflare Access.
- Transmission's 2018 DNS rebinding fix: a `Host` allowlist on by default.
- Syncthing's warning banner when the GUI is reachable without a password.

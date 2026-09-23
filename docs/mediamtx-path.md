# MediaMTX path for the P2S

PrintCast does not run MediaMTX. Add this path on the existing LXC. GrowCast keeps `growcam`.

The access code is the printer LAN code. Put it only in the MediaMTX config on the LXC, not in git.

```yaml
paths:
  p2s:
    source: rtsps://bblp:ACCESS_CODE@PRINTER_IP:322/streaming/live/1
    sourceProtocol: tcp
    rtspTransport: tcp
    sourceOnDemand: yes
    # Keep the printer session up while a browser is watching. 30s lets a
    # short HLS gap close the camera, and the next open often never resumes.
    sourceOnDemandCloseAfter: 1h
    # SHA256 fingerprint from the printer certificate. Example:
    # echo | openssl s_client -connect PRINTER_IP:322 2>/dev/null | openssl x509 -fingerprint -sha256 -noout
    sourceFingerprint: SHA256:REPLACE
```

`sourceOnDemand` means MediaMTX opens the printer camera only while someone is watching or the media worker is taking a snapshot. The worker must read the republished RTSP URL (`MEDIAMTX_RTSP_URL`), not `rtsps://…:322`, so the printer does not get a second session.

Publish HLS on its own Cloudflare hostname, the same way GrowCast publishes its stream. Set that public URL as `PUBLIC_HLS_URL` or in Admin. There is no token on the playlist.

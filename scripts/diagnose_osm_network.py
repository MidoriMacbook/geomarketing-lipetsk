"""Small operator diagnostic: DNS and TLS to the configured public OSM hosts."""
import logging
import socket
import ssl
from urllib.parse import urlparse

from src.config import OVERPASS_URLS


def diagnose():
    logger = logging.getLogger(__name__)
    for endpoint in OVERPASS_URLS:
        host = urlparse(endpoint).hostname
        try:
            addresses = socket.getaddrinfo(host, 443, type=socket.SOCK_STREAM)
        except OSError as exc:
            logger.info('OSM network %s DNS errno=%s', host, exc.errno)
            continue
        seen = set()
        for family, _, _, _, address in addresses:
            if family in seen:
                continue
            seen.add(family)
            try:
                with socket.socket(family, socket.SOCK_STREAM) as stream:
                    stream.settimeout(3)
                    stream.connect(address)
                    with ssl.create_default_context().wrap_socket(stream, server_hostname=host):
                        logger.info('OSM network %s %s TLS OK', host, family.name)
            except OSError as exc:
                logger.info('OSM network %s %s %s errno=%s',
                            host, family.name, type(exc).__name__, exc.errno)


if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO)
    diagnose()

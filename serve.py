"""Production entry point: python serve.py (Windows and Linux)."""
import logging
import os

# Avoid multiplying BLAS threads across simultaneous web requests.
os.environ.setdefault('OMP_NUM_THREADS', '1')
os.environ.setdefault('OPENBLAS_NUM_THREADS', '1')

from waitress import serve
from app import app
from src.config import server_host, server_port


if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO)
    serve(app, host=server_host('0.0.0.0'),
          port=server_port(8080), threads=4)

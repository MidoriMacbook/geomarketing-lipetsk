"""ГеоМаркетинг-Липецк: Flask composition and development entry point."""
from flask import Flask, send_from_directory

from src.config import PROJECT_ROOT, server_host, server_port
from src.routes.health import blueprint as health_routes
from src.routes.catalog import blueprint as catalog_routes
from src.routes.calculate import blueprint as calculate_routes


def create_app():
    application = Flask(__name__, static_folder=str(PROJECT_ROOT / 'static'))
    application.register_blueprint(health_routes)
    application.register_blueprint(catalog_routes)
    application.register_blueprint(calculate_routes)

    @application.route('/')
    def index():
        return send_from_directory(application.static_folder, 'index.html')

    return application


app = create_app()


if __name__ == '__main__':
    app.run(host=server_host('127.0.0.1'),
            port=server_port(5001), debug=False, threaded=True)

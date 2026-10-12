"""Shared business names, model parameters, and OpenStreetMap filters."""

BUSINESS_CATALOG = {
    'cafe': {
        'name': 'Кофейня', 'R': 350, 'alpha': 1.5,
        'tags': ['"amenity"="cafe"', '"shop"="coffee"', '"shop"="pastry"',
                 '"shop"="confectionery"'],
    },
    'pharmacy': {
        'name': 'Аптека', 'R': 500, 'alpha': 3.0,
        'tags': ['"amenity"="pharmacy"', '"healthcare"="pharmacy"'],
    },
    'grocery': {
        'name': 'Продуктовый магазин', 'R': 400, 'alpha': 2.0,
        'tags': ['"shop"="supermarket"', '"shop"="convenience"'],
    },
    'bakery': {
        'name': 'Пекарня', 'R': 350, 'alpha': 1.8,
        'tags': ['"shop"="bakery"'],
    },
    'beauty': {
        'name': 'Салон красоты', 'R': 450, 'alpha': 1.6,
        'tags': ['"shop"="hairdresser"', '"shop"="beauty"'],
    },
}

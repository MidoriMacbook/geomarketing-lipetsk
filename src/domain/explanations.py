"""Facts behind existing recommendations, using the model's unchanged kernels."""
import math

import numpy as np

from src.utils.geo import to_meters


def explain_recommendations(houses, competitors, center, half, parameters,
                            recommendations, centroids):
    """Return explanations in recommendation order without mutating model outputs.

    Inputs are validated model data. ``half`` is the loaded bounding box half-size;
    the category's R describes demand reach, independently of that loaded area.
    """
    radius, alpha = parameters['R'], parameters['alpha']
    h_xy = to_meters(houses[:, :2], *center)
    c_xy = to_meters(competitors, *center) if len(competitors) else np.empty((0, 2))
    centers_xy = (to_meters([[item['lat'], item['lng']] for item in centroids], *center)
                  if centroids else np.empty((0, 2)))
    points_xy = to_meters([[item['lat'], item['lng']] for item in recommendations], *center)
    facts = []
    for xy in points_xy:
        house_distances = np.linalg.norm(h_xy - xy, axis=1)
        demand = float((houses[:, 2] * np.exp(-(house_distances / radius)**2)).sum())
        competitor_distances = np.linalg.norm(c_xy - xy, axis=1)
        pressure = float(np.exp(-(competitor_distances / (0.8 * radius))**2).sum())
        multiplier = 1 + alpha * pressure
        count = int((house_distances <= radius).sum())
        nearest = round(float(np.linalg.norm(centers_xy - xy, axis=1).min())) if len(centers_xy) else None
        metrics = {
            'houses_in_radius': count,
            'houses_per_km2': count / (math.pi * (radius / 1000)**2),
            'nearest_demand_center_m': nearest,
            'model_demand': demand,
            'competition_pressure': pressure,
            'competition_multiplier': multiplier,
        }
        strengths = [f'В радиусе {radius} м учтено домов: {count}']
        if nearest is not None:
            strengths.append(f'Ближайший учтённый центр спроса находится в {nearest} м')
        risks = ['Оценка жителей зависит от полноты добровольной разметки домов в OSM; '
                 'плотность относится только к учтённым домам']
        if not len(competitors):
            risks.append('В выборке OSM конкуренты не отмечены; это не означает отсутствия конкуренции')
        # Houses are fetched using a bounding box, while candidates occupy its inscribed circle.
        if bool(np.any(np.abs(xy) + radius > half)):
            risks.append('Круг доступности пересекает границу загруженной области: '
                         'спрос у границы может быть занижен')
        if multiplier > 4:
            risks.append('Штраф конкуренции в модели высокий; он не является оценкой риска убытка')
        field_checks = [
            'Проверьте конкурентов, которые могли отсутствовать в OSM',
            'Проверьте фактический поток людей, входы и пешеходную доступность',
            'Уточните наличие помещения, условия аренды и ограничения для выбранного бизнеса',
        ]
        facts.append({
            'version': 1, 'metrics': metrics,
            'competition_level': 'low' if multiplier <= 2 else 'moderate' if multiplier <= 4 else 'high',
            'strengths': strengths, 'risks': risks, 'field_checks': field_checks,
        })
    mean_demand = sum(item['metrics']['model_demand'] for item in facts) / len(facts) if facts else 0
    for item in facts:
        demand = item['metrics']['model_demand']
        item['demand_level'] = ('unknown' if mean_demand == 0 else
                                'higher' if demand > mean_demand * 1.1 else
                                'lower' if demand < mean_demand * 0.9 else 'similar')
    return facts

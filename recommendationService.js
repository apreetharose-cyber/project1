const equipmentModel = require('../models/equipmentModel');

function scoreEquipment(item, requirement) {
  let score = 0;

  if (requirement.equipmentType && item.equipment_type.toLowerCase() === requirement.equipmentType.toLowerCase()) {
    score += 40;
  }

  const budget = Number(requirement.budget) || 0;
  const price = Number(item.price_per_day);
  if (budget > 0) {
    if (price <= budget) score += 25;
    else if (price <= budget * 1.2) score += 10;
  }

  if (item.availability === 'Available') score += 15;

  const location = (requirement.location || '').toLowerCase();
  const serviceArea = (item.service_area || '').toLowerCase();
  const district = (item.district || '').toLowerCase();
  let distanceKm = 25; // approximation — see mapping note H
  if (location && (serviceArea.includes(location) || district.includes(location))) {
    score += 15;
    distanceKm = 5;
  }

  const rating = item.avg_rating != null ? Number(item.avg_rating) : null;
  if (rating != null) score += Math.round((rating / 5) * 5);

  return { score: Math.max(0, Math.min(100, score)), distanceKm };
}

const recommendationService = {
  async getRecommendations(requirement) {
    const equipmentList = await equipmentModel.allApprovedForRecommendation();

    const scored = equipmentList.map((item) => {
      const { score, distanceKm } = scoreEquipment(item, requirement);
      return {
        id: item.id,
        name: `${item.equipment_type}${item.brand ? ' - ' + item.brand : ''}`,
        photoUrl: item.photo || null,
        pricePerDay: item.price_per_day,
        rating: item.avg_rating != null ? Number(item.avg_rating) : null,
        availability: item.availability,
        distanceKm,
        suitabilityScore: score,
      };
    });

    return scored
      .filter((s) => s.suitabilityScore > 0)
      .sort((a, b) => b.suitabilityScore - a.suitabilityScore)
      .slice(0, 10);
  },
};

module.exports = recommendationService;
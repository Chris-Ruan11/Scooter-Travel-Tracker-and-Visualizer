// Convert meters to miles
export const metersToMiles = (meters) => {
  return meters * 0.000621371;
};

// Convert m/s to mph
export const mpsToMph = (mps) => {
  return mps * 2.23694;
};

// Format duration in seconds to readable string
export const formatDuration = (seconds) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
};

// Format distance
export const formatDistance = (miles) => {
  if (miles < 0.1) {
    return `${(miles * 5280).toFixed(0)} ft`;
  }
  return `${miles.toFixed(2)} mi`;
};

// $$$ value of time saved (because time is money!)
// $20/hour = $0.33/minute
export const calculateTimeSavingsValue = (timeSavedSeconds) => {
  const timeSavedMinutes = timeSavedSeconds / 60;
  const dollarPerMinute = 20 / 60; // $20/hour
  return timeSavedMinutes * dollarPerMinute;
};

// $$$ saved vs bird
// Bird pricing: $1 unlock + $0.39/minute 
export const calculateBirdCost = (durationSeconds) => {
  const UNLOCK_FEE = 1.00;
  const PER_MINUTE_RATE = 0.39;
  const durationMinutes = durationSeconds / 60;
  return UNLOCK_FEE + (durationMinutes * PER_MINUTE_RATE);
};

// Calculate time saved vs walking
// Walking speed: ~3 mph, Scooter average: ~12 mph
export const calculateTimeSaved = (distanceMiles, tripDurationSeconds) => {
  const walkingTimeSeconds = (distanceMiles / 3) * 3600; // hours to seconds
  const timeSavedSeconds = walkingTimeSeconds - tripDurationSeconds;
  return Math.max(0, timeSavedSeconds); // Don't show negative
};

// Calculate average speed
export const calculateAvgSpeed = (distanceMeters, durationSeconds) => {
  if (durationSeconds === 0) return 0;
  const mps = distanceMeters / durationSeconds;
  return mpsToMph(mps);
};

// Format currency
export const formatCurrency = (amount) => {
  return `$${amount.toFixed(2)}`;
};

// Trip stats
export const getTripStats = (trip, points) => {
  const distanceMiles = metersToMiles(trip.distance);
  const duration = trip.duration;
  const timeSavedSeconds = trip.time_saved;
  
  return {
    distance: formatDistance(distanceMiles),
    distanceMiles: distanceMiles,
    duration: formatDuration(duration),
    durationSeconds: duration,
    avgSpeed: `${trip.avg_speed.toFixed(1)} mph`,
    maxSpeed: `${trip.max_speed.toFixed(1)} mph`,
    
    timeValue: formatCurrency(calculateTimeSavingsValue(timeSavedSeconds)),
    birdCost: formatCurrency(calculateBirdCost(duration)),
    timeSaved: formatDuration(timeSavedSeconds),
    
    pointCount: points ? points.length : 0
  };
};

export default {
  metersToMiles,
  mpsToMph,
  formatDuration,
  formatDistance,
  calculateCostSavings,
  calculateTimeSaved,
  calculateAvgSpeed,
  formatCurrency,
  getTripStats
};

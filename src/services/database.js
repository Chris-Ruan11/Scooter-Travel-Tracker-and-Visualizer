import SQLite from 'react-native-sqlite-storage';

SQLite.DEBUG(true);
SQLite.enablePromise(true);

const database_name = 'scooter_tracker.db';
let db;

// Initialize database
export const initDB = async () => {
  try {
    db = await SQLite.openDatabase({ name: database_name });
    await createTables();
    console.log('Database initialized');
    return db;
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
};

// Create tables
const createTables = async () => {
  const tripsTable = `
    CREATE TABLE IF NOT EXISTS trips (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      start_time INTEGER NOT NULL,
      end_time INTEGER,
      distance REAL DEFAULT 0,
      avg_speed REAL DEFAULT 0,
      max_speed REAL DEFAULT 0,
      duration INTEGER DEFAULT 0,
      cost_saved REAL DEFAULT 0,
      time_saved INTEGER DEFAULT 0,
      notes TEXT,
      metadata TEXT
    );
  `;

  const pointsTable = `
    CREATE TABLE IF NOT EXISTS gps_points (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trip_id INTEGER NOT NULL,
      timestamp INTEGER NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      speed REAL,
      accuracy REAL,
      altitude REAL,
      FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE
    );
  `;

  const indexQuery = `
    CREATE INDEX IF NOT EXISTS idx_trip_id ON gps_points(trip_id);
    CREATE INDEX IF NOT EXISTS idx_timestamp ON gps_points(timestamp);
  `;

  await db.executeSql(tripsTable);
  await db.executeSql(pointsTable);
  await db.executeSql(indexQuery);
};

// Trip operations
export const createTrip = async (startTime) => {
  const query = 'INSERT INTO trips (start_time) VALUES (?)';
  const result = await db.executeSql(query, [startTime]);
  return result[0].insertId;
};

export const updateTrip = async (tripId, data) => {
  const fields = [];
  const values = [];
  
  Object.keys(data).forEach(key => {
    fields.push(`${key} = ?`);
    values.push(data[key]);
  });
  
  values.push(tripId);
  const query = `UPDATE trips SET ${fields.join(', ')} WHERE id = ?`;
  await db.executeSql(query, values);
};

export const getAllTrips = async () => {
  const query = 'SELECT * FROM trips ORDER BY start_time DESC';
  const results = await db.executeSql(query);
  const trips = [];
  
  for (let i = 0; i < results[0].rows.length; i++) {
    trips.push(results[0].rows.item(i));
  }
  
  return trips;
};

export const getTrip = async (tripId) => {
  const query = 'SELECT * FROM trips WHERE id = ?';
  const results = await db.executeSql(query, [tripId]);
  return results[0].rows.item(0);
};

export const deleteTrip = async (tripId) => {
  await db.executeSql('DELETE FROM trips WHERE id = ?', [tripId]);
};

// GPS point operations
export const addGPSPoint = async (tripId, point) => {
  const query = `
    INSERT INTO gps_points 
    (trip_id, timestamp, latitude, longitude, speed, accuracy, altitude) 
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;
  
  await db.executeSql(query, [
    tripId,
    point.timestamp,
    point.latitude,
    point.longitude,
    point.speed || 0,
    point.accuracy || 0,
    point.altitude || 0
  ]);
};

export const getTripPoints = async (tripId) => {
  const query = 'SELECT * FROM gps_points WHERE trip_id = ? ORDER BY timestamp ASC';
  const results = await db.executeSql(query, [tripId]);
  const points = [];
  
  for (let i = 0; i < results[0].rows.length; i++) {
    points.push(results[0].rows.item(i));
  }
  
  return points;
};

// Stats
export const getTotalStats = async () => {
  const query = `
    SELECT 
      COUNT(*) as total_trips,
      SUM(distance) as total_distance,
      SUM(duration) as total_duration,
      SUM(cost_saved) as total_cost_saved,
      SUM(time_saved) as total_time_saved,
      AVG(avg_speed) as overall_avg_speed
    FROM trips
    WHERE end_time IS NOT NULL
  `;
  
  const results = await db.executeSql(query);
  return results[0].rows.item(0);
};

export default {
  initDB,
  createTrip,
  updateTrip,
  getAllTrips,
  getTrip,
  deleteTrip,
  addGPSPoint,
  getTripPoints,
  getTotalStats
};

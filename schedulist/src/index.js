const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const dotenv = require('dotenv');
const path = require('path');
const { sequelize } = require('./models');
const { subdomainExtractor } = require('./middleware/auth.middleware');

// Import routes
const authRoutes = require('./routes/auth.routes');
const bcbaRoutes = require('./routes/bcba.routes');
const therapistRoutes = require('./routes/therapist.routes');
const patientRoutes = require('./routes/patient.routes');
const scheduleRoutes = require('./routes/schedule.routes');
const patientSchedulingRoutes = require('./routes/patientScheduling.routes');
const adminRoutes = require('./routes/admin.routes');
const organizationRoutes = require('./routes/organization.routes');
const proxyRoutes = require('./routes/proxy.routes');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(helmet());
app.use(cors({
  origin: true, // Allow all origins since we're using subdomains
  credentials: true
}));
app.use(express.json());

// Extract tenant info from subdomain
app.use(subdomainExtractor);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/bcba', bcbaRoutes);
app.use('/api/therapist', therapistRoutes);
app.use('/api/patient', patientRoutes);
app.use('/api/schedule', scheduleRoutes);
app.use('/api/patient-scheduling', patientSchedulingRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/organization', organizationRoutes);
app.use('/api/proxy', proxyRoutes);

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Root route
app.get('/', (req, res) => {
  res.send('TheraThere API is running');
});

// Start server
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  
  try {
    await sequelize.authenticate();
    console.log('Database connection established successfully.');
  } catch (error) {
    console.error('Unable to connect to the database:', error);
  }
});
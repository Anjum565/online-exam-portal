const mongoose = require('mongoose');
require('dotenv').config();
const User = require('./models/User');
const fs = require('fs');
const path = require('path');

async function fix() {
  if (process.env.MONGODB_URI) {
    await mongoose.connect(process.env.MONGODB_URI);
    const res = await User.updateOne(
      { email: 'admin@gmail.com' },
      { $set: { role: 'admin', department: 'Examination Control Division' } }
    );
    console.log('MongoDB update for admin@gmail.com:', res);

    const user = await User.findOne({ email: 'admin@gmail.com' }, 'name email role department isVerified');
    console.log('Verified user in DB:', user);
  }

  // Also update local data_store.json if present
  const storePath = path.join(__dirname, 'data_store.json');
  if (fs.existsSync(storePath)) {
    const store = JSON.parse(fs.readFileSync(storePath, 'utf8'));
    if (store && Array.isArray(store.users)) {
      let found = false;
      store.users = store.users.map(u => {
        if (u.email === 'admin@gmail.com') {
          found = true;
          return { ...u, role: 'admin', department: 'Examination Control Division' };
        }
        return u;
      });
      if (!found) {
        store.users.push({
          id: 'usr_admin_gmail',
          _id: 'usr_admin_gmail',
          name: 'Admin',
          email: 'admin@gmail.com',
          role: 'admin',
          department: 'Examination Control Division',
          isVerified: true,
          createdAt: new Date()
        });
      }
      // Ensure admin@test.com also in data_store.json
      if (!store.users.some(u => u.email === 'admin@test.com')) {
        store.users.push({
          id: 'usr_admin_demo',
          _id: 'usr_admin_demo',
          name: 'System Administrator (Admin)',
          email: 'admin@test.com',
          role: 'admin',
          department: 'Examination Control Division',
          isVerified: true,
          createdAt: new Date()
        });
      }
      fs.writeFileSync(storePath, JSON.stringify(store, null, 2), 'utf8');
      console.log('Updated data_store.json successfully.');
    }
  }

  process.exit(0);
}

fix().catch(err => {
  console.error(err);
  process.exit(1);
});

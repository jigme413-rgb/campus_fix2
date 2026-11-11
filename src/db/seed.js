const bcrypt = require('bcryptjs');

const CATEGORIES = ['Electrical', 'Plumbing', 'Wi-Fi', 'Furniture', 'Hostel', 'Cleaning', 'Other'];

const DEMO_USERS = [
  { name: 'Tashi Dorji', email: 'student@sherubtse.edu.bt', password: 'Student@123', role: 'student' },
  { name: 'Pema Choden', email: 'lecturer@sherubtse.edu.bt', password: 'Staff@123', role: 'staff' },
  { name: 'Karma Wangdi', email: 'electrician@sherubtse.edu.bt', password: 'Maint@123', role: 'maintenance' },
  { name: 'Sonam Tshering', email: 'plumber@sherubtse.edu.bt', password: 'Maint@123', role: 'maintenance' },
];

async function upsertUser(client, { name, email, password, role }) {
  const hash = await bcrypt.hash(password, 10);
  const { rows } = await client.query(
    `INSERT INTO users (name, email, password_hash, role)
     VALUES ($1, LOWER($2), $3, $4)
     ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
     RETURNING id`,
    [name, email, hash, role]
  );
  return rows[0].id;
}

async function seed(client, { demo = true } = {}) {
  for (const name of CATEGORIES) {
    await client.query('INSERT INTO categories (name) VALUES ($1) ON CONFLICT (name) DO NOTHING', [name]);
  }

  const adminId = await upsertUser(client, {
    name: 'Ugyen Wangmo',
    email: process.env.ADMIN_EMAIL || 'admin@sherubtse.edu.bt',
    password: process.env.ADMIN_PASSWORD || 'Admin@123',
    role: 'admin',
  });

  if (!demo) return;

  const ids = {};
  for (const u of DEMO_USERS) ids[u.role + (ids[u.role] ? '2' : '')] = await upsertUser(client, u);

  // Only add sample requests to an empty database so re-running setup never duplicates them.
  const { rows: existing } = await client.query('SELECT COUNT(*)::int AS n FROM requests');
  if (existing[0].n > 0) return;

  const cat = async (name) =>
    (await client.query('SELECT id FROM categories WHERE name = $1', [name])).rows[0].id;

  const samples = [
    {
      title: 'Tube light flickering in Lecture Hall 3',
      description: 'Two of the front tube lights flicker constantly, making the board hard to read.',
      location: 'Academic Block A, Lecture Hall 3', priority: 'High', category: 'Electrical',
      reporter: ids.student, flow: ['Assigned', 'In Progress', 'Completed'], staff: ids.maintenance,
    },
    {
      title: 'Leaking tap in boys hostel washroom',
      description: 'The second tap from the left leaks all night and the floor stays wet.',
      location: 'Boys Hostel 2, Ground floor washroom', priority: 'Medium', category: 'Plumbing',
      reporter: ids.student, flow: ['Assigned', 'In Progress'], staff: ids.maintenance2,
    },
    {
      title: 'No Wi-Fi in the library reading room',
      description: 'Devices connect to the access point but get no internet since Monday.',
      location: 'Library, First floor reading room', priority: 'Urgent', category: 'Wi-Fi',
      reporter: ids.staff, flow: ['Assigned'], staff: ids.maintenance,
    },
    {
      title: 'Broken chairs in Computer Lab 1',
      description: 'Four chairs in the back row have broken backrests.',
      location: 'IT Block, Computer Lab 1', priority: 'Low', category: 'Furniture',
      reporter: ids.staff, flow: [], staff: null,
    },
  ];

  for (const s of samples) {
    const { rows } = await client.query(
      `INSERT INTO requests (title, description, location, priority, reporter_id, category_id)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [s.title, s.description, s.location, s.priority, s.reporter, await cat(s.category)]
    );
    const requestId = rows[0].id;
    await client.query(
      `INSERT INTO status_history (request_id, old_status, new_status, changed_by, note)
       VALUES ($1, NULL, 'Pending', $2, 'Request submitted')`,
      [requestId, s.reporter]
    );

    let previous = 'Pending';
    for (const next of s.flow) {
      const changedBy = next === 'Assigned' ? adminId : s.staff;
      await client.query(
        `UPDATE requests
            SET status = $1::varchar,
                assigned_to = COALESCE(assigned_to, $2),
                updated_at = NOW(),
                completed_at = CASE WHEN $1::varchar = 'Completed' THEN NOW() ELSE completed_at END
          WHERE id = $3`,
        [next, s.staff, requestId]
      );
      await client.query(
        `INSERT INTO status_history (request_id, old_status, new_status, changed_by)
         VALUES ($1, $2, $3, $4)`,
        [requestId, previous, next, changedBy]
      );
      previous = next;
    }
  }
}

module.exports = { seed, CATEGORIES, DEMO_USERS };

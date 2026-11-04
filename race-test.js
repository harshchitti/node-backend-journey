import 'dotenv/config';
import pool from './db.js';

const URL = 'http://localhost:3000/booking';
const TOKENS = { A: process.env.TOKEN_A, B: process.env.TOKEN_B, C: process.env.TOKEN_C };

// tomorrow's date in IST: always in the future, inside the 7-day horizon
const day = new Date(Date.now() + (5.5 + 24) * 3600 * 1000).toISOString().slice(0, 10);
const slot = (s, e) => ({ start_time: `${day}T${s}:00+05:30`, end_time: `${day}T${e}:00+05:30` });

async function post(user, body) {
  return fetch(URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKENS[user]}` },
    body: JSON.stringify(body),
  });
}

async function book(user, room_id, [s, e]) {
  const res = await post(user, { room_id, ...slot(s, e) });
  if (![201, 409].includes(res.status)) {
    console.log('  unexpected', res.status, (await res.text()).slice(0, 150));
  }
  return res.status;
}

async function bookGetId(user, room_id, [s, e]) {
  const res = await post(user, { room_id, ...slot(s, e) });
  const data = await res.json();
  return { status: res.status, id: data.message?.id };
}

async function cancel(user, id) {
  const res = await fetch(`${URL}/${id}/cancel`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${TOKENS[user]}` },
  });
  return res.status;
}

async function preflight() {
  for (const user of Object.keys(TOKENS)) {
    if (!TOKENS[user]) {
      console.log(`TOKEN_${user} is missing from .env`);
      return false;
    }
    let res;
    try {
      res = await post(user, { room_id: 0, ...slot('10:00', '11:00') });
    } catch {
      console.log('Cannot reach the server on port 3000. Is it running?');
      return false;
    }
    if (res.status !== 400) {
      console.log(`Preflight failed for user ${user}: got ${res.status}, expected 400`);
      console.log((await res.text()).slice(0, 150));
      console.log('401 = bad or expired token. 404 HTML page = route missing, restart the server.');
      return false;
    }
  }
  return true;
}

async function scenario(name, requests, expected) {
  await pool.query('DELETE FROM bookings'); // dev database only
  const statuses = await Promise.all(requests());
  const n201 = statuses.filter(s => s === 201).length;
  const n409 = statuses.filter(s => s === 409).length;
  const pass = n201 === expected[201] && n409 === expected[409] && n201 + n409 === statuses.length;
  console.log(pass ? 'PASS' : 'FAIL', '-', name, '| got', statuses.join(','), '| expected', JSON.stringify(expected));
}

try {
  if (!(await preflight())) process.exit(1);

  const { rows } = await pool.query("SELECT id FROM rooms WHERE status = 'active' ORDER BY id LIMIT 2");
  if (rows.length < 2) {
    console.log('Need at least 2 active rooms in the rooms table.');
    process.exit(1);
  }
  const [R1, R2] = [rows[0].id, rows[1].id];
  console.log(`Using rooms ${R1} and ${R2}, date ${day}\n`);

  await scenario('1. same room, same slot, 3 different users',
    () => [book('A', R1, ['10:00', '11:00']), book('B', R1, ['10:00', '11:00']), book('C', R1, ['10:00', '11:00'])],
    { 201: 1, 409: 2 });

  await scenario('2. same user, two different rooms, same time',
    () => [book('A', R1, ['10:00', '11:00']), book('A', R2, ['10:00', '11:00'])],
    { 201: 1, 409: 1 });

  await scenario('3. same room, partially overlapping slots',
    () => [book('A', R1, ['10:00', '11:00']), book('B', R1, ['10:30', '11:30'])],
    { 201: 1, 409: 1 });

  await scenario('4. same room, back-to-back slots (both must succeed)',
    () => [book('A', R1, ['10:00', '11:00']), book('B', R1, ['11:00', '12:00'])],
    { 201: 2, 409: 0 });

  await scenario('5. different rooms, different users (both must succeed)',
    () => [book('A', R1, ['10:00', '11:00']), book('B', R2, ['10:00', '11:00'])],
    { 201: 2, 409: 0 });

  await scenario('6. same user, 5 identical requests',
    () => [1, 2, 3, 4, 5].map(() => book('A', R1, ['10:00', '11:00'])),
    { 201: 1, 409: 4 });

  {
    await pool.query('DELETE FROM bookings');
    const { status, id } = await bookGetId('A', R1, ['10:00', '11:00']);
    if (status !== 201) {
      console.log('FAIL - 7. setup booking failed with', status);
    } else {
      const statuses = await Promise.all([cancel('A', id), cancel('A', id)]);
      const { rows: after } = await pool.query('SELECT status FROM bookings WHERE id = $1', [id]);
      const pass = statuses.every(s => s === 200) && after[0].status === 'cancelled';
      console.log(pass ? 'PASS' : 'FAIL', '- 7. two cancels of the same booking | got', statuses.join(','), '| row is', after[0].status);
    }
  }
    {
    let rebooked = 0, blocked = 0, bad = 0;
    for (let i = 0; i < 10; i++) {
      await pool.query('DELETE FROM bookings');
      const { status, id } = await bookGetId('A', R1, ['10:00', '11:00']);
      if (status !== 201) { bad++; continue; }
      const [c, b] = await Promise.all([
        cancel('A', id),
        book('B', R1, ['10:00', '11:00']),
      ]);
      const { rows: conf } = await pool.query(
        "SELECT count(*)::int AS n FROM bookings WHERE room_id = $1 AND status = 'confirmed'",
        [R1]
      );
      const ok = c === 200 && (b === 201 || b === 409) && conf[0].n <= 1;
      if (!ok) bad++;
      else if (b === 201) rebooked++;
      else blocked++;
    }
    console.log(bad === 0 ? 'PASS' : 'FAIL',
      `- 8. cancel vs rebook x10 | rebooked ${rebooked}, blocked ${blocked}, bad ${bad}`);
  }
} finally {
  await pool.query('DELETE FROM bookings');
  await pool.end();
}
async function bookSlot(label) {
  const res = await fetch('http://localhost:3000/booking', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      room_id: 4,
      user_id: 5,
      start_time: "2026-09-30T13:00:00.000Z",
      end_time: "2026-09-30T14:00:00.000Z"
    })
  });
  const text = await res.text();
  console.log(label, res.status, text);
}

Promise.all([
  bookSlot('Request A'),
  bookSlot('Request B'),
  bookSlot('Request C'),
  bookSlot('Request D'),
  bookSlot('Request E')
]);
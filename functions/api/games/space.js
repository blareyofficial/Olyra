const maxBodies = 24;
const maxSteps = 8;
const maxRequestBytes = 16 * 1024;
const worldLimit = 3000;
const responseHeaders = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store'
};

function json(body, status = 200) {
  return Response.json(body, { status, headers: responseHeaders });
}

function isFiniteRange(value, min, max) {
  return Number.isFinite(value) && value >= min && value <= max;
}

async function readLimitedBody(request) {
  const reader = request.body?.getReader();
  if (!reader) return '';
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxRequestBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

function readBodies(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > maxBodies) return null;
  const bodies = [];
  for (const body of value) {
    if (
      !body ||
      typeof body !== 'object' ||
      !isFiniteRange(body.x, -worldLimit, worldLimit) ||
      !isFiniteRange(body.y, -worldLimit, worldLimit) ||
      !isFiniteRange(body.vx, -1000, 1000) ||
      !isFiniteRange(body.vy, -1000, 1000) ||
      !isFiniteRange(body.mass, 0.1, 10000) ||
      !isFiniteRange(body.radius, 1, 60) ||
      typeof body.color !== 'string' ||
      !/^#[0-9a-f]{6}$/i.test(body.color)
    ) return null;
    bodies.push({
      x: body.x,
      y: body.y,
      vx: body.vx,
      vy: body.vy,
      mass: body.mass,
      radius: body.radius,
      color: body.color
    });
  }
  return bodies;
}

function accelerations(bodies, gravity) {
  return bodies.map((body, index) => {
    let ax = 0;
    let ay = 0;
    for (let otherIndex = 0; otherIndex < bodies.length; otherIndex++) {
      if (index === otherIndex) continue;
      const other = bodies[otherIndex];
      const dx = other.x - body.x;
      const dy = other.y - body.y;
      const distanceSquared = dx * dx + dy * dy + 100;
      const factor = gravity * other.mass / (distanceSquared * Math.sqrt(distanceSquared));
      ax += dx * factor;
      ay += dy * factor;
    }
    return { ax, ay };
  });
}

function calculateEnergy(bodies, gravity) {
  let kinetic = 0;
  let potential = 0;
  for (let i = 0; i < bodies.length; i++) {
    const body = bodies[i];
    kinetic += 0.5 * body.mass * (body.vx * body.vx + body.vy * body.vy);
    for (let j = i + 1; j < bodies.length; j++) {
      const other = bodies[j];
      const dx = other.x - body.x;
      const dy = other.y - body.y;
      potential -= gravity * body.mass * other.mass / Math.sqrt(dx * dx + dy * dy + 100);
    }
  }
  return { kinetic, potential, energy: kinetic + potential };
}

export async function onRequest(context) {
  if (context.request.method !== 'POST') return json({ error: 'Use POST to simulate gravity.' }, 405);

  const contentLength = Number(context.request.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > maxRequestBytes) return json({ error: 'The simulation request is too large.' }, 413);

  let text;
  try {
    text = await readLimitedBody(context.request);
  } catch {
    return json({ error: 'The request body could not be read.' }, 400);
  }
  if (text === null) return json({ error: 'The simulation request is too large.' }, 413);

  let input;
  try {
    input = JSON.parse(text);
  } catch {
    return json({ error: 'The request must contain valid JSON.' }, 400);
  }

  if (
    !input ||
    typeof input !== 'object' ||
    !isFiniteRange(input.gravity, 0, 5) ||
    !Number.isInteger(input.steps) ||
    input.steps < 1 ||
    input.steps > maxSteps ||
    !isFiniteRange(input.dt, 0.01, 0.1)
  ) return json({ error: 'Gravity, step count, or time step is outside the supported range.' }, 400);

  const bodies = readBodies(input.bodies);
  if (!bodies) return json({ error: `Provide between 1 and ${maxBodies} valid objects.` }, 400);

  const step = input.dt;
  for (let iteration = 0; iteration < input.steps; iteration++) {
    const forces = accelerations(bodies, input.gravity);
    for (let index = 0; index < bodies.length; index++) {
      const body = bodies[index];
      body.vx = Math.max(-1000, Math.min(1000, body.vx + forces[index].ax * step));
      body.vy = Math.max(-1000, Math.min(1000, body.vy + forces[index].ay * step));
      body.x += body.vx * step;
      body.y += body.vy * step;
      if (body.x < -worldLimit || body.x > worldLimit) {
        body.x = Math.max(-worldLimit, Math.min(worldLimit, body.x));
        body.vx *= -0.8;
      }
      if (body.y < -worldLimit || body.y > worldLimit) {
        body.y = Math.max(-worldLimit, Math.min(worldLimit, body.y));
        body.vy *= -0.8;
      }
    }
  }

  const stats = calculateEnergy(bodies, input.gravity);
  if (![stats.kinetic, stats.potential, stats.energy].every(Number.isFinite)) {
    return json({ error: 'This configuration produced unstable simulation values. Adjust the objects or gravity.' }, 422);
  }
  return json({
    bodies,
    stats: {
      bodyCount: bodies.length,
      simulatedSeconds: input.steps * step,
      kinetic: stats.kinetic,
      potential: stats.potential,
      energy: stats.energy
    }
  });
}

/**
 * engine.mjs
 * ------------------------------------------------------------
 * Motor puro de la simulación "particle-life" (sin canvas, sin
 * React, sin CLI). Lo usan tanto simulate.mjs (una corrida) como
 * batch-simulate.mjs (muchas corridas con distintos parámetros).
 * ------------------------------------------------------------
 */

export const WORLD_WIDTH = 1500;
export const WORLD_HEIGHT = 1200;

export const DEFAULT_PARAMS = {
    INITIAL_PARTICLES: 500,
    MAX_PARTICLES: 5000,
    FOOD_MAX: 100,
    WATER_MAX: 100,
    INTERACTION_RADIUS: 72,
    NEARBY_RADIUS_NORMALIZED: 0.055,
    MAX_DECISION_NEARBY: 8,
    MIN_REPRODUCTION_AGE: 1,
    REPRODUCTION_COOLDOWN: 2,
    REPRODUCTION_CHANCE: 0.6,
    REPRODUCTION_SELF_MIN_ENERGY: 72,
    REPRODUCTION_PARTNER_MIN_ENERGY: 58,
    REPRODUCTION_SELF_COST: 24,
    REPRODUCTION_PARTNER_COST: 18,
    CHILD_INITIAL_ENERGY: 100,
    ENERGY_DRAIN_PER_SECOND: 0.42,
    MAX_SPEED: 0.16,
    MOVE_ACCELERATION: 0.0018,
    SEPARATION_DISTANCE_MULTIPLIER: 1.8,
    SEPARATION_STRENGTH: 0.04,
    DECISION_RATE: 1.8,
    SPEED_MULTIPLIER: 2,
    INITIAL_LIFESPAN_MIN: 45,
    INITIAL_LIFESPAN_MAX: 100,
    INITIAL_ENERGY_MIN: 70,
    INITIAL_ENERGY_MAX: 100,
    CHILD_RADIUS_MUTATION: 0.6,
    CHILD_VELOCITY_FACTOR: 0.55,
    CHILD_POSITION_RANDOMNESS: 0.003,
    CHILD_VELOCITY_RANDOMNESS: 0.04,
    MIN_RADIUS: 4,
    MAX_RADIUS: 9,
    INITIAL_RADIUS_MIN: 4,
    INITIAL_RADIUS_MAX: 8,
    INITIAL_VELOCITY_MAX: 0.035,
    POSITION_MARGIN: 0.04,
};

const FIRST_NAMES = [
    "Ada", "Bruno", "Clara", "Dario", "Elena", "Gael", "Iris", "Leo",
    "Mara", "Nora", "Omar", "Paula", "Rita", "Sergio", "Vera", "Yago",
];

const SURNAMES = [
    "Sol", "Luna", "Río", "Bosque", "Cobre", "Prado", "Vega", "Niebla",
    "Roca", "Sierra", "Valle", "Mar", "Olmo", "Brisa", "Cano", "Faro",
];

let creationClock = 0;

function randomBetween(min, max) {
    return min + Math.random() * (max - min);
}

function randomItem(items) {
    return items[Math.floor(Math.random() * items.length)];
}

function makeIdentity(parent, partner) {
    if (!parent || !partner) {
        return {
            firstName: randomItem(FIRST_NAMES),
            firstSurname: randomItem(SURNAMES),
            secondSurname: randomItem(SURNAMES),
        };
    }
    return {
        firstName: randomItem(FIRST_NAMES),
        firstSurname: Math.random() < 0.5 ? parent.firstSurname : parent.secondSurname,
        secondSurname: Math.random() < 0.5 ? partner.firstSurname : partner.secondSurname,
    };
}

export function createParticle(generation = 0, parent, partner, params = DEFAULT_PARAMS) {
    const identity = makeIdentity(parent, partner);
    const hue = parent
        ? (parent.hue + randomBetween(-18, 18) + 360) % 360
        : randomBetween(0, 360);

    return {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
        x: parent
            ? Math.min(1 - params.POSITION_MARGIN, Math.max(params.POSITION_MARGIN, (parent.x + (partner?.x ?? parent.x)) / 2 + randomBetween(-params.CHILD_POSITION_RANDOMNESS, params.CHILD_POSITION_RANDOMNESS)))
            : randomBetween(0.05, 0.95),
        y: parent
            ? Math.min(1 - params.POSITION_MARGIN, Math.max(params.POSITION_MARGIN, (parent.y + (partner?.y ?? parent.y)) / 2 + randomBetween(-params.CHILD_POSITION_RANDOMNESS, params.CHILD_POSITION_RANDOMNESS)))
            : randomBetween(0.05, 0.95),
        vx: parent ? parent.vx * params.CHILD_VELOCITY_FACTOR + randomBetween(-params.CHILD_VELOCITY_RANDOMNESS, params.CHILD_VELOCITY_RANDOMNESS) : randomBetween(-params.INITIAL_VELOCITY_MAX, params.INITIAL_VELOCITY_MAX),
        vy: parent ? parent.vy * params.CHILD_VELOCITY_FACTOR + randomBetween(-params.CHILD_VELOCITY_RANDOMNESS, params.CHILD_VELOCITY_RANDOMNESS) : randomBetween(-params.INITIAL_VELOCITY_MAX, params.INITIAL_VELOCITY_MAX),
        radius: parent ? Math.max(params.MIN_RADIUS, Math.min(params.MAX_RADIUS, parent.radius + randomBetween(-params.CHILD_RADIUS_MUTATION, params.CHILD_RADIUS_MUTATION))) : randomBetween(params.INITIAL_RADIUS_MIN, params.INITIAL_RADIUS_MAX),
        age: 0,
        lifespan: randomBetween(params.INITIAL_LIFESPAN_MIN, params.INITIAL_LIFESPAN_MAX),
        generation,
        food: params.FOOD_MAX,
        water: params.WATER_MAX,
        energy: parent ? params.CHILD_INITIAL_ENERGY : randomBetween(params.INITIAL_ENERGY_MIN, params.INITIAL_ENERGY_MAX),
        reproductionCooldown: params.REPRODUCTION_COOLDOWN,
        hue,
        ...identity,
        parentIds: parent && partner ? [parent.id, partner.id] : [],
        bornAt: creationClock,
    };
}

export function createInitialParticles(params) {
    return Array.from({ length: params.INITIAL_PARTICLES }, () => createParticle(0, undefined, undefined, params));
}

export function buildGenealogy(particles, previous = {}) {
    const genealogy = { ...previous };
    for (const particle of particles) {
        genealogy[particle.id] = {
            id: particle.id,
            firstName: particle.firstName,
            firstSurname: particle.firstSurname,
            secondSurname: particle.secondSurname,
            generation: particle.generation,
            parentIds: [...particle.parentIds],
            bornAt: particle.bornAt,
        };
    }
    return genealogy;
}

// Nota: en el original es `async` pero no hace ningún await real, así
// que aquí se ejecuta síncronamente (más simple y más rápido).
function decideParticleAction(context) {
    const { self, nearby, params } = context;

    const partner = nearby.find((candidate) => {
        if (
            candidate.id === self.id ||
            candidate.age < params.MIN_REPRODUCTION_AGE ||
            candidate.energy <= params.REPRODUCTION_PARTNER_MIN_ENERGY ||
            candidate.reproductionCooldown > 0
        ) {
            return false;
        }
        const dx = (candidate.x - self.x) * WORLD_WIDTH;
        const dy = (candidate.y - self.y) * WORLD_HEIGHT;
        const distance = Math.hypot(dx, dy);
        const collisionDistance = self.radius + candidate.radius;
        return distance <= collisionDistance;
    });

    if (
        partner &&
        self.age >= params.MIN_REPRODUCTION_AGE &&
        self.energy > params.REPRODUCTION_SELF_MIN_ENERGY &&
        self.reproductionCooldown <= 0 &&
        Math.random() < params.REPRODUCTION_CHANCE
    ) {
        return { type: "reproduce", partnerId: partner.id };
    }

    if (nearby.length > 0) {
        let ax = 0;
        let ay = 0;
        for (const other of nearby) {
            ax += other.x - self.x;
            ay += other.y - self.y;
        }
        const len = Math.hypot(ax, ay) || 1;
        return { type: "move", dx: ax / len, dy: ay / len };
    }

    return { type: "idle" };
}

function applyAction(particlesById, genealogy, elapsed, params, particleId, action) {
    const current = particlesById.get(particleId);
    if (!current) return null;

    if (action.type === "move") {
        current.vx += action.dx * params.MOVE_ACCELERATION;
        current.vy += action.dy * params.MOVE_ACCELERATION;
        return null;
    }

    if (action.type === "reproduce" && particlesById.size < params.MAX_PARTICLES) {
        const partner = particlesById.get(action.partnerId);
        if (!partner) return null;

        if (
            current.age < params.MIN_REPRODUCTION_AGE ||
            partner.age < params.MIN_REPRODUCTION_AGE ||
            current.energy <= params.REPRODUCTION_SELF_MIN_ENERGY ||
            partner.energy <= params.REPRODUCTION_PARTNER_MIN_ENERGY ||
            current.reproductionCooldown > 0 ||
            partner.reproductionCooldown > 0
        ) {
            return null;
        }

        const dx = (partner.x - current.x) * WORLD_WIDTH;
        const dy = (partner.y - current.y) * WORLD_HEIGHT;
        const distance = Math.hypot(dx, dy);
        const collisionDistance = current.radius + partner.radius;
        if (distance > collisionDistance) return null;

        const generation = Math.max(current.generation, partner.generation) + 1;
        const child = createParticle(generation, current, partner, params);

        genealogy[child.id] = {
            id: child.id,
            firstName: child.firstName,
            firstSurname: child.firstSurname,
            secondSurname: child.secondSurname,
            generation: child.generation,
            parentIds: [...child.parentIds],
            bornAt: elapsed,
        };

        current.energy -= params.REPRODUCTION_SELF_COST;
        partner.energy -= params.REPRODUCTION_PARTNER_COST;
        current.reproductionCooldown = params.REPRODUCTION_COOLDOWN;
        partner.reproductionCooldown = params.REPRODUCTION_COOLDOWN;

        return child;
    }

    return null;
}

/** Avanza el estado un paso fijo `dt`. Devuelve stats del paso (nacimientos/muertes). */
export function tick(state, params, dt) {
    state.elapsed += dt;
    creationClock = state.elapsed;

    const particles = state.particles;
    const particlesById = new Map(particles.map((p) => [p.id, p]));
    const newborns = [];
    const populationBefore = particles.length;

    for (const particle of particles) {
        particle.age += dt;
        particle.reproductionCooldown = Math.max(0, particle.reproductionCooldown - dt);
        particle.food = params.FOOD_MAX;
        particle.water = params.WATER_MAX;
        particle.energy = Math.max(0, particle.energy - dt * params.ENERGY_DRAIN_PER_SECOND);

        const nearby = [];
        for (const other of particles) {
            if (other.id === particle.id) continue;
            const dx = other.x - particle.x;
            const dy = other.y - particle.y;
            if (dx * dx + dy * dy < params.NEARBY_RADIUS_NORMALIZED * params.NEARBY_RADIUS_NORMALIZED) {
                nearby.push(other);
            }
        }

        if (nearby.length && Math.random() < dt * (params.DECISION_RATE * params.SPEED_MULTIPLIER)) {
            const action = decideParticleAction({
                self: particle,
                nearby: nearby.slice(0, params.MAX_DECISION_NEARBY),
                world: { width: WORLD_WIDTH, height: WORLD_HEIGHT, maxParticles: params.MAX_PARTICLES },
                params,
            });
            const child = applyAction(particlesById, state.genealogy, state.elapsed, params, particle.id, action);
            if (child) {
                particlesById.set(child.id, child);
                newborns.push(child);
            }
        }

        let separationX = 0;
        let separationY = 0;
        for (const other of nearby) {
            const dx = particle.x - other.x;
            const dy = particle.y - other.y;
            const distance = Math.hypot(dx, dy) || 0.0001;
            const minDistance = (particle.radius + other.radius) / WORLD_WIDTH;
            if (distance < minDistance * params.SEPARATION_DISTANCE_MULTIPLIER) {
                const strength = (minDistance * params.SEPARATION_DISTANCE_MULTIPLIER - distance) / distance;
                separationX += dx * strength;
                separationY += dy * strength;
            }
        }

        particle.vx += separationX * params.SEPARATION_STRENGTH;
        particle.vy += separationY * params.SEPARATION_STRENGTH;

        const speed = Math.hypot(particle.vx, particle.vy);
        if (speed > params.MAX_SPEED) {
            particle.vx = (particle.vx / speed) * params.MAX_SPEED;
            particle.vy = (particle.vy / speed) * params.MAX_SPEED;
        }

        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;

        if (particle.x < 0) { particle.x = 0; particle.vx *= -1; }
        else if (particle.x > 1) { particle.x = 1; particle.vx *= -1; }
        if (particle.y < 0) { particle.y = 0; particle.vy *= -1; }
        else if (particle.y > 1) { particle.y = 1; particle.vy *= -1; }
    }

    if (newborns.length) particles.push(...newborns);

    state.particles = particles.filter((p) => p.age < p.lifespan && p.energy > 0);

    return {
        births: newborns.length,
        deaths: populationBefore + newborns.length - state.particles.length,
    };
}

/** Métricas agregadas del estado actual, pensadas como fila de dataset para ML. */
export function summarize(state) {
    const particles = state.particles;
    const n = particles.length;
    if (n === 0) {
        return {
            time: state.elapsed, population: 0, avgEnergy: 0, avgAge: 0, avgLifespan: 0,
            avgRadius: 0, avgSpeed: 0, maxGeneration: 0, avgGeneration: 0,
        };
    }

    let energy = 0, age = 0, lifespan = 0, radius = 0, speed = 0, generation = 0, maxGeneration = 0;
    for (const p of particles) {
        energy += p.energy;
        age += p.age;
        lifespan += p.lifespan;
        radius += p.radius;
        speed += Math.hypot(p.vx, p.vy);
        generation += p.generation;
        if (p.generation > maxGeneration) maxGeneration = p.generation;
    }

    return {
        time: state.elapsed,
        population: n,
        avgEnergy: energy / n,
        avgAge: age / n,
        avgLifespan: lifespan / n,
        avgRadius: radius / n,
        avgSpeed: speed / n,
        maxGeneration,
        avgGeneration: generation / n,
    };
}

export function createInitialState(params) {
    const particles = createInitialParticles(params);
    return {
        elapsed: 0,
        particles,
        genealogy: buildGenealogy(particles),
    };
}

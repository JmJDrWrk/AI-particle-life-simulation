#!/usr/bin/env node
/**
 * batch-simulate.mjs
 * ------------------------------------------------------------
 * Lanza MUCHAS corridas de la simulación seguidas, cada una con
 * parámetros distintos, pensado para dejarlo corriendo horas y
 * generar un dataset de entrenamiento en JSON.
 *
 * Cada corrida guarda un archivo runs/run-XXXX.json con:
 *   { runId, params, dt, seconds, timeseries: [...], finalPopulation,
 *     totalBirths, totalDeaths, extinct, realSeconds }
 * "timeseries" es una fila por muestra de tiempo con métricas
 * agregadas (población, energía media, edad media, etc.) — el
 * formato pensado para entrenar un modelo.
 *
 * Además se mantiene manifest.json actualizado tras cada corrida,
 * así que puedes ver el progreso sin esperar a que termine todo.
 *
 * ---------------- MODOS DE BARRIDO ----------------
 *
 * 1) GRID (por defecto): combina todos los valores dados con --grid
 *    node batch-simulate.mjs --seconds-per-run 600 \
 *        --grid INITIAL_PARTICLES=200,500,800 \
 *        --grid REPRODUCTION_CHANCE=0.3,0.6,0.9
 *    -> corre 3x3 = 9 combinaciones
 *
 * 2) RANDOM: muestrea N combinaciones al azar dentro de rangos
 *    node batch-simulate.mjs --mode random --samples 50 --seconds-per-run 600 \
 *        --random INITIAL_PARTICLES=100:1000 \
 *        --random REPRODUCTION_CHANCE=0.1:1
 *
 *    Con --all-params se muestrean TODOS los parámetros de la
 *    simulación (no solo los que listes con --random), usando los
 *    rangos por defecto definidos en ALL_PARAM_RANGES. Recomendado
 *    para que el modelo de ML luego pueda aprender el efecto de cada
 *    parámetro, no solo de un par de ellos:
 *    node batch-simulate.mjs --mode random --all-params --samples 500 \
 *        --hours 6 --seconds-per-run 900 --out ./dataset
 *
 * 3) REPEAT: repite los parámetros por defecto N veces (para medir
 *    varianza dado que hay aleatoriedad en la simulación)
 *    node batch-simulate.mjs --runs 20 --seconds-per-run 600
 *
 * 4) FILE: usa combinaciones ya elegidas por fuera (p. ej. por
 *    `train_model.py sample-survivable`) en vez de generarlas aquí:
 *    node batch-simulate.mjs --combos-file ./combos.json --seconds-per-run 900
 *
 * ---------------- CONTROL DE DURACIÓN ----------------
 *   --hours N        deja de lanzar corridas nuevas tras N horas reales
 *                     (la corrida en curso SÍ se completa)
 *   --runs N          número máximo de corridas (si no se usa --grid)
 *   --seconds-per-run N  segundos SIMULADOS que dura cada corrida
 * ------------------------------------------------------------
 */
import fs from "node:fs";
import path from "node:path";
import { DEFAULT_PARAMS, createInitialState, tick, summarize } from "./engine.mjs";
// import { MinioStorage } from "./minioImp.mjs";
// Rangos por defecto para CADA parámetro de la simulación, usados por
// --all-params en modo random. Elegidos como un entorno razonable
// alrededor de los valores por defecto (ni tan estrechos que no aporten
// variedad al dataset, ni tan anchos que casi todo acabe en extinción).
export const ALL_PARAM_RANGES = {
    INITIAL_PARTICLES: [200, 200],
    MAX_PARTICLES: [10000, 10000],
    FOOD_MAX: [100, 100],
    WATER_MAX: [100, 100],
    INTERACTION_RADIUS: [20, 150],
    NEARBY_RADIUS_NORMALIZED: [0.01, 0.15],
    MAX_DECISION_NEARBY: [2, 20],
    MIN_REPRODUCTION_AGE: [1, 5],
    REPRODUCTION_COOLDOWN: [0.2, 8],
    REPRODUCTION_CHANCE: [0.05, 1],
    REPRODUCTION_SELF_MIN_ENERGY: [10, 50],
    REPRODUCTION_PARTNER_MIN_ENERGY: [10, 50],
    REPRODUCTION_SELF_COST: [5, 40],
    REPRODUCTION_PARTNER_COST: [5, 40],
    CHILD_INITIAL_ENERGY: [40, 100],
    ENERGY_DRAIN_PER_SECOND: [1, 1],
    MAX_SPEED: [0.02, 0.4],
    MOVE_ACCELERATION: [0.0002, 0.006],
    SEPARATION_DISTANCE_MULTIPLIER: [1, 3],
    SEPARATION_STRENGTH: [0.005, 0.15],
    DECISION_RATE: [0.3, 4],
    SPEED_MULTIPLIER: [1, 1],//,[0.5, 5],
    INITIAL_LIFESPAN_MIN: [10, 80],
    INITIAL_LIFESPAN_MAX: [40, 100],
    INITIAL_ENERGY_MIN: [30, 90],
    INITIAL_ENERGY_MAX: [60, 100],
    CHILD_RADIUS_MUTATION: [0.5, 0.5],//[0.1, 1.5],
    CHILD_VELOCITY_FACTOR: [0.01, 0.01],//[0.1, 1],
    CHILD_POSITION_RANDOMNESS: [0.01, 0.01],//[0.0005, 0.01],
    CHILD_VELOCITY_RANDOMNESS: [0.1, 0.1],//[0.005, 0.1],
    MIN_RADIUS: [2, 6],
    MAX_RADIUS: [6, 14],
    INITIAL_RADIUS_MIN: [2, 6],
    INITIAL_RADIUS_MAX: [6, 14],
    INITIAL_VELOCITY_MAX: [0.1, 0.1],//[0.005, 0.08],
    POSITION_MARGIN: [0.1, 0.1],//[0.01, 0.1],
};

// Pares (min, max) que deben quedar ordenados tras el muestreo, o la
// simulación puede comportarse de forma degenerada (p.ej. radio mínimo
// mayor que el máximo).
const MIN_MAX_PAIRS = [
    ["INITIAL_LIFESPAN_MIN", "INITIAL_LIFESPAN_MAX"],
    ["INITIAL_ENERGY_MIN", "INITIAL_ENERGY_MAX"],
    ["MIN_RADIUS", "MAX_RADIUS"],
    ["INITIAL_RADIUS_MIN", "INITIAL_RADIUS_MAX"],
];

function fixupCombo(combo) {
    for (const [minKey, maxKey] of MIN_MAX_PAIRS) {
        if (combo[minKey] != null && combo[maxKey] != null && combo[minKey] > combo[maxKey]) {
            [combo[minKey], combo[maxKey]] = [combo[maxKey], combo[minKey]];
        }
    }
    // MAX_PARTICLES siempre debe poder alojar al menos a la población inicial
    if (combo.INITIAL_PARTICLES != null && combo.MAX_PARTICLES != null) {
        combo.MAX_PARTICLES = Math.max(combo.MAX_PARTICLES, Math.ceil(combo.INITIAL_PARTICLES * 1.5));
    }
    return combo;
}

function parseArgs(argv) {
    const args = {
        secondsPerRun: 600,
        dt: 0.05,
        summaryEvery: 1,
        out: "./batch-output",
        mode: "grid",
        samples: 20,
        runs: 10,
        hours: null,
        fullSnapshot: false,
        allParams: false,
        combosFile: null,
        gridSpecs: [],
        randomSpecs: [],
        baseOverrides: {},
    };

    for (let i = 0; i < argv.length; i += 1) {
        const a = argv[i];
        if (a === "--seconds-per-run") args.secondsPerRun = Number(argv[++i]);
        else if (a === "--dt") args.dt = Number(argv[++i]);
        else if (a === "--summary-every") args.summaryEvery = Number(argv[++i]);
        else if (a === "--out") args.out = argv[++i];
        else if (a === "--mode") args.mode = argv[++i];
        else if (a === "--samples") args.samples = Number(argv[++i]);
        else if (a === "--runs") args.runs = Number(argv[++i]);
        else if (a === "--hours") args.hours = Number(argv[++i]);
        else if (a === "--full-snapshot") args.fullSnapshot = true;
        else if (a === "--all-params") args.allParams = true;
        else if (a === "--combos-file") args.combosFile = argv[++i];
        else if (a === "--grid") args.gridSpecs.push(argv[++i]);
        else if (a === "--random") args.randomSpecs.push(argv[++i]);
        else if (a === "--param") {
            const [key, value] = argv[++i].split("=");
            args.baseOverrides[key] = Number(value);
        }
    }
    return args;
}

// "KEY=1,2,3" -> { key: "KEY", values: [1,2,3] }
function parseGridSpec(spec) {
    const [key, list] = spec.split("=");
    return { key, values: list.split(",").map(Number) };
}

// "KEY=min:max" -> { key: "KEY", min, max }
function parseRandomSpec(spec) {
    const [key, range] = spec.split("=");
    const [min, max] = range.split(":").map(Number);
    return { key, min, max };
}

function cartesianProduct(specs) {
    if (specs.length === 0) return [{}];
    return specs.reduce(
        (acc, { key, values }) =>
            acc.flatMap((combo) => values.map((v) => ({ ...combo, [key]: v }))),
        [{}],
    );
}

const INTEGER_PARAM_KEYS = new Set(["INITIAL_PARTICLES", "MAX_PARTICLES", "MAX_DECISION_NEARBY"]);

function sampleValue(key, min, max) {
    const value = min + Math.random() * (max - min);
    return INTEGER_PARAM_KEYS.has(key) ? Math.round(value) : value;
}

function randomCombo(specs, { allParams } = {}) {
    const combo = {};

    // Si --all-params está activo, partimos de un muestreo de TODOS los
    // parámetros conocidos, para que cada uno "juegue su papel" en el
    // dataset en lugar de quedarse fijo en su valor por defecto.
    if (allParams) {
        for (const [key, [min, max]] of Object.entries(ALL_PARAM_RANGES)) {
            combo[key] = sampleValue(key, min, max);
        }
    }

    // Cualquier --random explícito pisa el valor de --all-params para
    // esa clave (permite fijar un rango a medida para un parámetro
    // concreto mientras el resto se muestrea igualmente).
    for (const { key, min, max } of specs) {
        combo[key] = sampleValue(key, min, max);
    }

    return fixupCombo(combo);
}

function buildParamCombos(args) {
    if (args.combosFile) {
        console.debug('Using outter config "combosFile" arg')
        // Combinaciones ya elegidas por fuera (p. ej. por
        // train_model.py sample-survivable) en vez de generarlas aquí.
        const raw = fs.readFileSync(args.combosFile, "utf8");
        const combos = JSON.parse(raw);
        if (!Array.isArray(combos) || combos.length === 0) {
            throw new Error(`--combos-file ${args.combosFile} debe contener un array JSON no vacío de objetos {PARAM: valor}.`);
        }
        return combos;
    }
    if (args.mode === "grid") {
        const specs = args.gridSpecs.map(parseGridSpec);
        return cartesianProduct(specs);
    }
    if (args.mode === "random") {
        const specs = args.randomSpecs.map(parseRandomSpec);
        return Array.from({ length: args.samples }, () => randomCombo(specs, { allParams: args.allParams }));
    }
    // "repeat"
    return Array.from({ length: args.runs }, () => ({}));
}


// !!IMPORTANT!!
const MAX_PART_SEC_LIMIT = 2500;


function runOne(runId, paramOverrides, args) {
    const params = { ...DEFAULT_PARAMS, ...args.baseOverrides, ...paramOverrides };
    const state = createInitialState(params);
    const timeseries = [summarize(state)];
    let lastSummary = 0;
    let totalBirths = 0;
    let totalDeaths = 0;
    const startedAt = Date.now();

    while (state.elapsed < args.secondsPerRun) {
        process.stdout.clearLine(0);
        process.stdout.cursorTo(0);
        process.stdout.write(`\tparts: ${state.particles.length}\tbs: ${totalBirths}\tds: ${totalDeaths}\teps: ${state.elapsed | 0}\t`);
        const { births, deaths } = tick(state, params, args.dt);
        totalBirths += births;
        totalDeaths += deaths;

        if (state.elapsed - lastSummary >= args.summaryEvery) {
            lastSummary = state.elapsed;
            timeseries.push(summarize(state));
        }

        if (state.particles.length > MAX_PART_SEC_LIMIT) {
            // console.log('[MAX_PART_SEC_LIMIT] = 2500 rule jumped!!')
            break;
        }

        if (state.particles.length === 0) break;
    }

    const result = {
        runId,
        params,
        dt: args.dt,
        secondsRequested: args.secondsPerRun,
        secondsSimulated: state.elapsed,
        realSeconds: (Date.now() - startedAt) / 1000,
        finalPopulation: state.particles.length,
        totalBirths,
        totalDeaths,
        extinct: state.particles.length === 0,
        timeseries,
    };

    if (args.fullSnapshot) {
        result.finalParticles = state.particles;
        result.genealogy = state.genealogy;
    }

    return result;
}

function main() {
    const args = parseArgs(process.argv.slice(2));
    const runsDir = path.join(args.out, "runs");
    fs.mkdirSync(runsDir, { recursive: true });

    const combos = buildParamCombos(args);
    const deadlineMs = args.hours ? Date.now() + args.hours * 3600 * 1000 : null;

    const modeLabel = args.combosFile ? `file (${args.combosFile})` : args.mode;
    console.log(`Modo: ${modeLabel}. Corridas planeadas: ${combos.length}. ${args.hours ? `Límite: ${args.hours}h reales.` : ""}`);

    const manifest = {
        startedAt: new Date().toISOString(),
        mode: args.mode,
        secondsPerRun: args.secondsPerRun,
        dt: args.dt,
        plannedRuns: combos.length,
        runs: [],
    };

    let completed = 0;
    const batchStartedAt = Date.now();

    for (let i = 0; i < combos.length; i += 1) {
        if (deadlineMs && Date.now() >= deadlineMs) {
            console.log(`Límite de ${args.hours}h alcanzado. Parando tras ${completed} corridas.`);
            break;
        }

        const runId = String(i).padStart(4, "0");
        console.log(`\n[${i + 1}/${combos.length}] corrida ${runId} — overrides: ${JSON.stringify(combos[i])}`);

        const result = runOne(runId, combos[i], args);

        let fileName = `run-${runId}.json`;
        if (result.finalPopulation >= MAX_PART_SEC_LIMIT) {
            console.warn('Skip write due to "too many particles to simulate!"')
            fileName = `broke-run-${runId}.json`;
        }

        let filePath = `runs/${fileName}`;
        const runPath = path.join(runsDir, fileName);
        fs.writeFileSync(runPath, JSON.stringify(result));

        manifest.runs.push({
            runId,
            file: filePath,
            overrides: combos[i],
            finalPopulation: result.finalPopulation,
            extinct: result.extinct,
            secondsSimulated: result.secondsSimulated,
            realSeconds: result.realSeconds,
        });

        fs.writeFileSync(path.join(args.out, "manifest.json"), JSON.stringify(manifest, null, 2));
        // MinioStorage.saveJson(
        //     `${args.dataset}/runs/run-${runId}.json`,
        //     result,
        // );

        completed += 1;
        console.log(
            `  -> población final=${result.finalPopulation} | nacimientos=${result.totalBirths} | ` +
            `muertes=${result.totalDeaths} | real=${result.realSeconds.toFixed(1)}s`,
        );


    }

    manifest.finishedAt = new Date().toISOString();
    manifest.completedRuns = completed;
    fs.writeFileSync(path.join(args.out, "manifest.json"), JSON.stringify(manifest, null, 2));

    const totalReal = (Date.now() - batchStartedAt) / 1000;
    console.log(`\n=== Batch terminado: ${completed}/${combos.length} corridas en ${(totalReal / 60).toFixed(1)} min reales ===`);
    console.log(`Datos en: ${path.resolve(args.out)}`);
}

main();

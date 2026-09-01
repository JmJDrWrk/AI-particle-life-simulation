#!/usr/bin/env python3
"""
train_model.py
------------------------------------------------------------
Entrena un modelo con el dataset generado por batch-simulate.mjs
(carpeta con manifest.json + runs/run-XXXX.json) y permite luego
preguntarle: "¿qué parámetros debo usar para que la población se
estabilice en 500?".

Instala dependencias:
    pip install pandas numpy scikit-learn scipy joblib

------------------------------------------------------------
1) ENTRENAR
    python train_model.py train --dataset ./dataset --out ./model

    Lee runs/*.json, construye una fila por run con:
      - features: TODOS los parámetros usados en esa run
      - targets:  población en estado estable, estabilidad (CV),
                  y si se extinguió
    Entrena 2 regresores (RandomForest) + 1 clasificador y los
    guarda en --out con joblib.

2) SUGERIR PARÁMETROS PARA UN OBJETIVO
    python train_model.py suggest --model ./model --target-population 500

    Busca (optimización numérica sobre el modelo entrenado, NO
    corriendo la simulación) la combinación de parámetros cuya
    población en estado estable predicha se acerque más a 500,
    penalizando combinaciones inestables o con alta probabilidad
    de extinción.

3) EVALUAR EL MODELO
    python train_model.py evaluate --model ./model
    Imprime la importancia de cada parámetro.
------------------------------------------------------------
"""

import argparse
import json
import sys
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from scipy.optimize import differential_evolution
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, r2_score, accuracy_score

STEADY_STATE_FRACTION = 0.2  # último 20% de la serie temporal = "estado estable"
TARGET_POP_COL = "steady_state_population"
TARGET_STABILITY_COL = "instability"  # coef. de variación en el tramo estable (menor = más estable)
TARGET_EXTINCT_COL = "extinct"


# ============================================================
# 1. CARGA DEL DATASET
# ============================================================
def iter_run_files(dataset_dir: Path):
    manifest_path = dataset_dir / "manifest.json"
    runs_dir = dataset_dir / "runs"

    if manifest_path.exists():
        manifest = json.loads(manifest_path.read_text())
        for entry in manifest.get("runs", []):
            run_path = dataset_dir / entry["file"]
            if run_path.exists():
                yield run_path
        return

    if runs_dir.exists():
        yield from sorted(runs_dir.glob("run-*.json"))
        return

    # dataset_dir apunta directamente a una carpeta de runs sueltas
    yield from sorted(dataset_dir.glob("run-*.json"))


def steady_state_stats(timeseries):
    """Devuelve (población media, coef. de variación) del último tramo de la serie."""
    if not timeseries:
        return 0.0, 1.0
    n = len(timeseries)
    window = timeseries[max(0, n - max(1, int(n * STEADY_STATE_FRACTION))):]
    pops = np.array([p["population"] for p in window], dtype=float)
    mean = float(pops.mean())
    std = float(pops.std())
    cv = std / mean if mean > 0 else 1.0
    return mean, cv


def load_dataset(dataset_dir: Path) -> pd.DataFrame:
    rows = []
    for run_path in iter_run_files(dataset_dir):
        try:
            data = json.loads(run_path.read_text())
        except (json.JSONDecodeError, OSError) as exc:
            print(f"  ! omitiendo {run_path.name}: {exc}", file=sys.stderr)
            continue

        params = data.get("params")
        timeseries = data.get("timeseries")
        if not params or not timeseries:
            print(f"  ! omitiendo {run_path.name}: sin params/timeseries", file=sys.stderr)
            continue

        steady_pop, instability = steady_state_stats(timeseries)
        row = dict(params)
        row[TARGET_POP_COL] = steady_pop
        row[TARGET_STABILITY_COL] = instability
        row[TARGET_EXTINCT_COL] = int(bool(data.get("extinct", steady_pop == 0)))
        row["_run_file"] = run_path.name
        rows.append(row)

    if not rows:
        raise SystemExit(
            f"No encontré runs válidas en {dataset_dir}. "
            "Esperaba manifest.json + runs/run-XXXX.json (salida de batch-simulate.mjs)."
        )

    return pd.DataFrame(rows)


# ============================================================
# 2. ENTRENAMIENTO
# ============================================================
def get_feature_columns(df: pd.DataFrame):
    exclude = {TARGET_POP_COL, TARGET_STABILITY_COL, TARGET_EXTINCT_COL, "_run_file"}
    return [c for c in df.columns if c not in exclude]


def train(dataset_dir: Path, out_dir: Path):
    print(f"Cargando dataset de {dataset_dir} ...")
    df = load_dataset(dataset_dir)
    feature_cols = get_feature_columns(df)
    print(f"  {len(df)} runs cargadas, {len(feature_cols)} parámetros como features.")

    X = df[feature_cols].fillna(df[feature_cols].median())
    y_extinct = df[TARGET_EXTINCT_COL]

    # El clasificador de extinción ve TODAS las runs (extintas y vivas).
    X_train, X_test, yext_train, yext_test = train_test_split(
        X, y_extinct, test_size=0.2, random_state=42, stratify=y_extinct if y_extinct.nunique() > 1 else None
    )
    extinct_model = RandomForestClassifier(n_estimators=100, max_depth=14, min_samples_leaf=3, random_state=42, n_jobs=2, class_weight="balanced")
    extinct_model.fit(X_train, yext_train)

    # Los regresores de "población estable" e "inestabilidad" solo tienen
    # sentido para runs que sobrevivieron: una run extinta no se "estabilizó"
    # en 0, simplemente murió. Mezclarlas ensucia el target de regresión.
    alive_df = df[df[TARGET_EXTINCT_COL] == 0]
    n_dropped = len(df) - len(alive_df)
    if n_dropped:
        print(f"  {n_dropped} runs extintas excluidas de los regresores de población/inestabilidad (siguen usándose para el clasificador de extinción).")
    if len(alive_df) < 20:
        print("  ! aviso: quedan muy pocas runs vivas para entrenar los regresores con fiabilidad.", file=sys.stderr)

    X_alive = alive_df[feature_cols].fillna(df[feature_cols].median())
    y_pop = alive_df[TARGET_POP_COL]
    y_instability = alive_df[TARGET_STABILITY_COL]

    Xa_train, Xa_test, ypop_train, ypop_test, yins_train, yins_test = train_test_split(
        X_alive, y_pop, y_instability, test_size=0.2, random_state=42
    )

    pop_model = RandomForestRegressor(n_estimators=150, max_depth=14, min_samples_leaf=3, random_state=42, n_jobs=2)
    pop_model.fit(Xa_train, ypop_train)

    instability_model = RandomForestRegressor(n_estimators=100, max_depth=14, min_samples_leaf=3, random_state=42, n_jobs=2)
    instability_model.fit(Xa_train, yins_train)

    pop_pred = pop_model.predict(Xa_test)
    print("\n=== Validación (20% held-out) ===")
    print(f"  Población estable  -> MAE={mean_absolute_error(ypop_test, pop_pred):.1f}  R2={r2_score(ypop_test, pop_pred):.3f}  (solo runs vivas, n={len(alive_df)})")
    if yext_test.nunique() > 1:
        ext_pred = extinct_model.predict(X_test)
        print(f"  Extinción           -> accuracy={accuracy_score(yext_test, ext_pred):.3f}  (todas las runs, n={len(df)})")
    ins_pred = instability_model.predict(Xa_test)
    print(f"  Inestabilidad (CV)  -> MAE={mean_absolute_error(yins_test, ins_pred):.3f}")

    out_dir.mkdir(parents=True, exist_ok=True)
    bounds = {c: (float(df[c].min()), float(df[c].max())) for c in feature_cols}

    joblib.dump(
        {
            "feature_cols": feature_cols,
            "bounds": bounds,
            "pop_model": pop_model,
            "instability_model": instability_model,
            "extinct_model": extinct_model,
        },
        out_dir / "model.joblib",
    )
    print(f"\nModelo guardado en {out_dir / 'model.joblib'}")

    importances = sorted(zip(feature_cols, pop_model.feature_importances_), key=lambda t: -t[1])
    print("\nParámetros más influyentes sobre la población estable:")
    for name, imp in importances[:10]:
        print(f"  {name:<32} {imp:.3f}")


# ============================================================
# 3. EVALUAR (útil si ya entrenaste y solo quieres ver importancias)
# ============================================================
def evaluate(model_dir: Path):
    bundle = joblib.load(model_dir / "model.joblib")
    pop_model = bundle["pop_model"]
    print("Parámetros más influyentes sobre la población estable:")
    importances = sorted(zip(bundle["feature_cols"], pop_model.feature_importances_), key=lambda t: -t[1])
    for name, imp in importances:
        print(f"  {name:<32} {imp:.3f}")


# ============================================================
# 4. SUGERENCIA DE PARÁMETROS PARA UN OBJETIVO
# ============================================================
def suggest(model_dir: Path, target_population: float, max_instability: float, fixed: dict, maxiter: int, popsize: int, workers: int):
    bundle = joblib.load(model_dir / "model.joblib")
    feature_cols = bundle["feature_cols"]
    bounds = bundle["bounds"]
    pop_model = bundle["pop_model"]
    instability_model = bundle["instability_model"]
    extinct_model = bundle["extinct_model"]

    for key in fixed:
        if key not in feature_cols:
            raise SystemExit(f"'{key}' no es un parámetro conocido por el modelo.")

    free_cols = [c for c in feature_cols if c not in fixed]
    search_bounds = [bounds[c] for c in free_cols]
    fixed_idx = [feature_cols.index(c) for c in fixed]
    fixed_vals = [fixed[c] for c in fixed]
    free_idx = [feature_cols.index(c) for c in free_cols]

    def build_rows(X: np.ndarray) -> pd.DataFrame:
        # X llega como (n_free_params, n_candidatos) desde differential_evolution
        # con vectorized=True. Montamos una matriz (n_candidatos, n_features).
        n_candidates = X.shape[1]
        full = np.empty((n_candidates, len(feature_cols)))
        full[:, free_idx] = X.T
        if fixed_idx:
            full[:, fixed_idx] = fixed_vals
        return pd.DataFrame(full, columns=feature_cols)

    def objective(X: np.ndarray) -> np.ndarray:
        # Evalúa TODOS los candidatos de la generación en una sola pasada
        # por cada modelo (mucho más rápido que fila a fila).
        rows = build_rows(X)
        pred_pop = pop_model.predict(rows)
        pred_instability = instability_model.predict(rows)
        pred_extinct_prob = _extinct_probability(extinct_model, rows)

        error = (pred_pop - target_population) ** 2
        instability_penalty = 200.0 * np.clip(pred_instability - max_instability, 0, None)
        extinction_penalty = 5000.0 * pred_extinct_prob
        return error + instability_penalty + extinction_penalty

    result = differential_evolution(
        objective,
        bounds=search_bounds,
        seed=42,
        maxiter=maxiter,
        popsize=popsize,
        tol=1e-6,
        polish=True,
        vectorized=True,
        updating="deferred",  # requerido por vectorized=True
        workers=1,  # vectorized ya paraleliza "de golpe"; no combinar con workers>1
    )

    best_row = build_rows(result.x.reshape(-1, 1))
    pred_pop = pop_model.predict(best_row)[0]
    pred_instability = instability_model.predict(best_row)[0]
    pred_extinct_prob = _extinct_probability(extinct_model, best_row)[0]

    print(f"\nObjetivo: población estable ≈ {target_population}\n")
    print("Parámetros sugeridos:")
    for c in feature_cols:
        value = best_row[c].iloc[0]
        marker = " (fijo)" if c in fixed else ""
        print(f"  {c:<32} {value:.4f}{marker}")

    print("\nPredicción del modelo con estos parámetros:")
    print(f"  Población estable esperada : {pred_pop:.1f}")
    print(f"  Inestabilidad (CV)         : {pred_instability:.3f}")
    print(f"  Prob. de extinción         : {pred_extinct_prob:.1%}")
    print(
        "\nNota: esto es una predicción del modelo, no una garantía — "
        "conviene correr la simulación real con estos valores para confirmar."
    )

    return {c: float(best_row[c].iloc[0]) for c in feature_cols}


def _extinct_probability(extinct_model, rows: pd.DataFrame) -> np.ndarray:
    """Prob. de clase 'extinct=1', robusto a cuando el modelo solo vio una clase en entrenamiento."""
    if not hasattr(extinct_model, "predict_proba"):
        return np.zeros(len(rows))
    proba = extinct_model.predict_proba(rows)
    classes = list(extinct_model.classes_)
    if 1 in classes:
        return proba[:, classes.index(1)]
    return np.zeros(len(rows))  # el modelo nunca vio extinciones en entrenamiento


# ============================================================
# 4. PREDICCIÓN: dado un conjunto de parámetros, ¿qué resultado da?
# ============================================================
def predict(model_dir: Path, overrides: dict):
    bundle = joblib.load(model_dir / "model.joblib")
    feature_cols = bundle["feature_cols"]
    bounds = bundle["bounds"]
    pop_model = bundle["pop_model"]
    instability_model = bundle["instability_model"]
    extinct_model = bundle["extinct_model"]

    for key in overrides:
        if key not in feature_cols:
            raise SystemExit(f"'{key}' no es un parámetro conocido por el modelo.")

    # Parámetros no especificados: se usa el punto medio del rango visto en el dataset
    row_values = {c: (bounds[c][0] + bounds[c][1]) / 2 for c in feature_cols}
    row_values.update(overrides)
    row = pd.DataFrame([[row_values[c] for c in feature_cols]], columns=feature_cols)

    pred_pop = pop_model.predict(row)[0]
    pred_instability = instability_model.predict(row)[0]
    pred_extinct_prob = _extinct_probability(extinct_model, row)[0]

    missing = [c for c in feature_cols if c not in overrides]
    if missing:
        print(f"(los {len(missing)} parámetros no indicados se fijaron al punto medio de su rango visto en el dataset)\n")

    print("Parámetros usados para la predicción:")
    for c in feature_cols:
        marker = "" if c in overrides else " (por defecto)"
        print(f"  {c:<32} {row_values[c]:.4f}{marker}")

    print("\nResultado predicho:")
    print(f"  Población estable esperada : {pred_pop:.1f}")
    print(f"  Inestabilidad (CV)         : {pred_instability:.3f}  (0 = perfectamente estable)")
    print(f"  Prob. de extinción         : {pred_extinct_prob:.1%}")

    return {
        "predicted_steady_state_population": float(pred_pop),
        "predicted_instability": float(pred_instability),
        "predicted_extinction_probability": float(pred_extinct_prob),
    }


# ============================================================
# 5. MUESTREO GUIADO: usar el clasificador de extinción para
#    proponer combinaciones que probablemente sobrevivan, en vez
#    de muestrear el espacio de parámetros a ciegas.
# ============================================================
# Mismos pares min/max que ALL_PARAM_RANGES en batch-simulate.mjs,
# para no generar combinaciones degeneradas (p. ej. MIN_RADIUS > MAX_RADIUS).
MIN_MAX_PAIRS = [
    ("INITIAL_LIFESPAN_MIN", "INITIAL_LIFESPAN_MAX"),
    ("INITIAL_ENERGY_MIN", "INITIAL_ENERGY_MAX"),
    ("MIN_RADIUS", "MAX_RADIUS"),
    ("INITIAL_RADIUS_MIN", "INITIAL_RADIUS_MAX"),
]
INTEGER_PARAM_KEYS = {"INITIAL_PARTICLES", "MAX_PARTICLES", "MAX_DECISION_NEARBY"}


def _random_pool(feature_cols, bounds, pool_size, rng):
    pool = np.empty((pool_size, len(feature_cols)))
    for j, col in enumerate(feature_cols):
        lo, hi = bounds[col]
        pool[:, j] = rng.uniform(lo, hi, size=pool_size)

    df = pd.DataFrame(pool, columns=feature_cols)

    for min_key, max_key in MIN_MAX_PAIRS:
        if min_key in df.columns and max_key in df.columns:
            lo = df[[min_key, max_key]].min(axis=1)
            hi = df[[min_key, max_key]].max(axis=1)
            df[min_key], df[max_key] = lo, hi

    if "INITIAL_PARTICLES" in df.columns and "MAX_PARTICLES" in df.columns:
        df["MAX_PARTICLES"] = np.maximum(df["MAX_PARTICLES"], np.ceil(df["INITIAL_PARTICLES"] * 1.5))

    for col in INTEGER_PARAM_KEYS & set(df.columns):
        df[col] = df[col].round()

    return df


def sample_survivable(model_dir: Path, count: int, pool_multiplier: int, max_extinction_prob: float, out_path: Path, seed: int):
    bundle = joblib.load(model_dir / "model.joblib")
    feature_cols = bundle["feature_cols"]
    bounds = bundle["bounds"]
    extinct_model = bundle["extinct_model"]

    rng = np.random.default_rng(seed)
    pool_size = count * pool_multiplier
    print(f"Generando {pool_size} combinaciones candidatas dentro de los rangos vistos en el dataset ...")
    pool_df = _random_pool(feature_cols, bounds, pool_size, rng)

    extinct_prob = _extinct_probability(extinct_model, pool_df)
    pool_df["_predicted_extinction_probability"] = extinct_prob

    survivable = pool_df[pool_df["_predicted_extinction_probability"] <= max_extinction_prob].copy()
    survivable = survivable.sort_values("_predicted_extinction_probability")

    if len(survivable) < count:
        print(
            f"  ! solo {len(survivable)} candidatos por debajo de {max_extinction_prob:.0%} de prob. de extinción "
            f"(de {pool_size} generados). Completo con los de menor probabilidad aunque superen el umbral.",
            file=sys.stderr,
        )
        remaining = pool_df.sort_values("_predicted_extinction_probability")
        survivable = remaining.head(count)
    else:
        survivable = survivable.head(count)

    print(
        f"  {len(survivable)} combinaciones seleccionadas. "
        f"Prob. de extinción predicha: media={survivable['_predicted_extinction_probability'].mean():.1%}, "
        f"máx={survivable['_predicted_extinction_probability'].max():.1%}"
    )

    combos = survivable[feature_cols].to_dict(orient="records")
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(combos, indent=2))
    print(f"\nGuardado en {out_path}")
    print(
        "Úsalo con batch-simulate.mjs así:\n"
        f"  node batch-simulate.mjs --combos-file {out_path} --seconds-per-run <N> --out ./dataset-round2"
    )


# ============================================================
# CLI
# ============================================================
def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)

    p_train = sub.add_parser("train", help="Entrena el modelo a partir del dataset de runs")
    p_train.add_argument("--dataset", type=Path, required=True, help="Carpeta con manifest.json + runs/")
    p_train.add_argument("--out", type=Path, default=Path("./model"), help="Carpeta donde guardar el modelo")

    p_eval = sub.add_parser("evaluate", help="Muestra importancia de parámetros de un modelo ya entrenado")
    p_eval.add_argument("--model", type=Path, required=True)

    p_suggest = sub.add_parser("suggest", help="Sugiere parámetros para lograr un resultado objetivo")
    p_suggest.add_argument("--model", type=Path, required=True)
    p_suggest.add_argument("--target-population", type=float, required=True)
    p_suggest.add_argument("--max-instability", type=float, default=0.15, help="Coef. de variación máximo tolerado (default 0.15)")
    p_suggest.add_argument(
        "--fix", action="append", default=[], metavar="KEY=VALUE",
        help="Fija un parámetro a un valor concreto en la búsqueda (repetible)",
    )
    p_suggest.add_argument("--maxiter", type=int, default=60, help="Generaciones de la búsqueda (default 60, antes 200 — bájalo si va lento)")
    p_suggest.add_argument("--popsize", type=int, default=15, help="Candidatos por parámetro y generación (default 15)")

    p_predict = sub.add_parser("predict", help="Predice el resultado de una combinación de parámetros concreta")
    p_predict.add_argument("--model", type=Path, required=True)
    p_predict.add_argument(
        "--param", action="append", default=[], metavar="KEY=VALUE",
        help="Parámetro a fijar para la predicción (repetible; el resto usa el punto medio del rango visto en el dataset)",
    )

    p_sample = sub.add_parser(
        "sample-survivable",
        help="Genera combinaciones de parámetros que el clasificador de extinción predice viables, para simular una 2ª ronda",
    )
    p_sample.add_argument("--model", type=Path, required=True)
    p_sample.add_argument("--count", type=int, default=500, help="Nº de combinaciones a devolver (default 500)")
    p_sample.add_argument("--pool-multiplier", type=int, default=20, help="Candidatos generados por cada uno devuelto, antes de filtrar (default 20)")
    p_sample.add_argument("--max-extinction-prob", type=float, default=0.3, help="Umbral de prob. de extinción predicha para aceptar un candidato (default 0.3)")
    p_sample.add_argument("--out", type=Path, default=Path("./combos.json"))
    p_sample.add_argument("--seed", type=int, default=42)

    args = parser.parse_args()

    if args.command == "train":
        train(args.dataset, args.out)
    elif args.command == "evaluate":
        evaluate(args.model)
    elif args.command == "suggest":
        fixed = {}
        for item in args.fix:
            key, value = item.split("=")
            fixed[key] = float(value)
        suggest(args.model, args.target_population, args.max_instability, fixed, args.maxiter, args.popsize, 1)
    elif args.command == "predict":
        overrides = {}
        for item in args.param:
            key, value = item.split("=")
            overrides[key] = float(value)
        predict(args.model, overrides)
    elif args.command == "sample-survivable":
        sample_survivable(args.model, args.count, args.pool_multiplier, args.max_extinction_prob, args.out, args.seed)


if __name__ == "__main__":
    main()

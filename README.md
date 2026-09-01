# Particle-Life: simulación headless + dataset + modelo de predicción

Puedes consultar y explorar los datos generados por este repositorio a través del [Explorador de Gráficas de AI-Simulation](https://jaimeromangil.com/tool/ai-simulation/charts)


Pipeline para correr la simulación de partículas fuera del navegador, generar
un dataset de miles de corridas con distintos parámetros, entrenar un modelo
que aprenda la relación *parámetros → resultado*, y usarlo para predecir o
sugerir configuraciones sin tener que ejecutar la simulación real cada vez.

```
engine.mjs            motor de la simulación (funciones puras, sin CLI)
simulate.mjs           corre UNA simulación y guarda su resultado en JSON
batch-simulate.mjs     corre MUCHAS simulaciones con distintos parámetros
train_model.py         entrena un modelo con el dataset y permite predecir/sugerir
page.tsx                página Next.js para cargar runs y verlas en gráficas
```

---

## 1. `engine.mjs`

Es el motor original de `page.tsx` (física + reproducción + energía)
extraído a funciones puras, **sin canvas, sin React, sin
`requestAnimationFrame`**. No se ejecuta directamente: lo importan
`simulate.mjs` y `batch-simulate.mjs`.

Exporta:

- `DEFAULT_PARAMS` — los ~35 parámetros de la simulación con sus valores por defecto.
- `createInitialState(params)` — crea el estado inicial (partículas + genealogía).
- `tick(state, params, dt)` — avanza un paso fijo `dt`. Devuelve `{ births, deaths }` de ese paso.
- `summarize(state)` — reduce el estado actual a una fila de métricas agregadas (población, energía media, edad media, radio medio, velocidad media, generación máxima/media). Es el formato que se usa como "fila de dataset".

Al no depender de tiempo real ni de `requestAnimationFrame`, se puede avanzar
el reloj tan rápido como la CPU lo permita.

**Limitación conocida:** la búsqueda de partículas vecinas es O(n²) (cada
partícula se compara con todas las demás cada paso), igual que en el
`page.tsx` original. Con pocos cientos de partículas es ~30x más rápido que
tiempo real; con miles, la ventaja se reduce bastante.

---

## 2. `simulate.mjs` — una sola corrida

```bash
node simulate.mjs --seconds 900 --dt 0.05 --snapshot 60 --out ./data \
  --param REPRODUCTION_CHANCE=0.6 \
  --param INITIAL_PARTICLES=400
```

| Flag | Qué hace |
|---|---|
| `--seconds` | tiempo simulado a correr |
| `--dt` | paso fijo (0.05 = igual que el original) |
| `--snapshot` | cada cuántos segundos simulados vuelca partículas + genealogía completas a disco |
| `--summary-every` | cada cuántos segundos simulados se guarda una fila en `timeseries.json` |
| `--particles` / `--max-particles` | atajos para `INITIAL_PARTICLES` / `MAX_PARTICLES` |
| `--param KEY=VALUE` | sobreescribe cualquier otro parámetro (repetible) |
| `--out` | carpeta de salida |

**Salidas** (en `--out`):
- `run-meta.json` — parámetros usados.
- `timeseries.json` — serie temporal de métricas agregadas (una fila por `--summary-every` segundos).
- `snapshot-<t>.json` — partículas + genealogía completas en momentos puntuales.
- `final.json` — estado final completo + timeseries entero.

Útil para: probar un cambio puntual, o **verificar a mano** una combinación de
parámetros que el modelo sugirió.

---

## 3. `batch-simulate.mjs` — muchas corridas seguidas

Pensado para dejarlo corriendo horas sin supervisión, generando el dataset
con el que luego entrena `train_model.py`.

### Modos de barrido

**`repeat`** (por defecto, sin `--mode`): repite los mismos parámetros
`--runs N` veces. Como la simulación tiene aleatoriedad (`Math.random()`),
sirve para medir varianza de un mismo punto del espacio de parámetros — por
ejemplo, para **verificar una predicción del modelo** corriendo la
combinación sugerida varias veces y viendo si la población converge donde
se esperaba.

```bash
node batch-simulate.mjs --runs 10 --seconds-per-run 900 --out ./verify \
  --param INITIAL_PARTICLES=300 --param REPRODUCTION_CHANCE=0.8
```

**`grid`**: combina (producto cartesiano) todos los valores dados con
`--grid KEY=v1,v2,v3` (repetible). Cuidado con la explosión combinatoria si
usas muchas claves.

```bash
node batch-simulate.mjs --mode grid --seconds-per-run 600 --out ./dataset \
  --grid INITIAL_PARTICLES=200,500,800 \
  --grid REPRODUCTION_CHANCE=0.3,0.6,0.9
```

**`random`**: muestrea `--samples N` combinaciones al azar. Con
`--random KEY=min:max` (repetible) solo varían las claves indicadas; con
`--all-params` se muestrean **los 35 parámetros de la simulación a la vez**
(usando los rangos por defecto de `ALL_PARAM_RANGES`), que es lo recomendado
para generar el dataset de entrenamiento — así el modelo puede aprender el
efecto de cada parámetro, no solo de un par de ellos.

```bash
node batch-simulate.mjs --mode random --all-params --samples 2000 \
  --hours 6 --seconds-per-run 900 --out ./dataset
```

`--all-params` se puede combinar con `--random KEY=min:max` para fijar un
rango a medida en algún parámetro concreto mientras el resto usa los rangos
por defecto. También se corrigen automáticamente combinaciones inválidas
(p. ej. `MIN_RADIUS > MAX_RADIUS` se intercambian; `MAX_PARTICLES` nunca
queda por debajo de `INITIAL_PARTICLES × 1.5`).

### Control de duración

| Flag | Qué hace |
|---|---|
| `--hours N` | deja de lanzar corridas **nuevas** tras N horas reales (la que esté en curso sí se completa) |
| `--runs N` | nº de corridas en modo `repeat` |
| `--samples N` | nº de corridas en modo `random` |
| `--seconds-per-run N` | segundos **simulados** por corrida |
| `--full-snapshot` | además del timeseries, guarda partículas + genealogía completas al final de cada corrida (mucho más pesado en disco) |

### Salidas (en `--out`)

- `manifest.json` — se reescribe tras cada corrida (progreso visible en vivo), con un resumen de todas: parámetros usados, población final, si se extinguió, etc.
- `runs/run-0000.json`, `run-0001.json`, ... — uno por corrida:
  ```json
  {
    "runId": "0000",
    "params": { ...los 35 parámetros usados... },
    "dt": 0.05,
    "secondsSimulated": 900,
    "finalPopulation": 512,
    "totalBirths": 341,
    "totalDeaths": 229,
    "extinct": false,
    "timeseries": [ { "time": 0, "population": 200, "avgEnergy": ..., ... }, ... ]
  }
  ```

Si el proceso se interrumpe (Ctrl+C, corte de luz), las corridas ya escritas
en `runs/` quedan intactas — solo se pierde la que estaba en curso.

---

## 4. `train_model.py` — entrenar y consultar el modelo

Lee el dataset generado por `batch-simulate.mjs` (`manifest.json` +
`runs/*.json`) y entrena 3 modelos `RandomForest`:

- **población en estado estable** (media de las últimas `20%` filas del `timeseries` de cada run) — regresión.
- **inestabilidad** (coeficiente de variación de la población en ese mismo tramo; 0 = perfectamente estable) — regresión.
- **probabilidad de extinción** — clasificación.

```bash
pip install pandas numpy scikit-learn scipy joblib
```

### Entrenar

```bash
python train_model.py train --dataset ./dataset --out ./model
```

Guarda `model.joblib` (los 3 modelos + los rangos de cada parámetro vistos
en el dataset) e imprime el error de validación (MAE/R²) y qué parámetros
pesan más sobre la población estable.

### Predecir (parámetros → resultado)

```bash
python train_model.py predict --model ./model \
  --param INITIAL_PARTICLES=400 --param REPRODUCTION_CHANCE=0.6
```

Los parámetros no indicados se fijan al punto medio de su rango visto en el
dataset. Imprime población estable esperada, inestabilidad y probabilidad de
extinción predichas — sin correr la simulación.

### Sugerir (resultado deseado → parámetros)

```bash
python train_model.py suggest --model ./model --target-population 500
python train_model.py suggest --model ./model --target-population 500 \
  --fix INITIAL_PARTICLES=300 --maxiter 100 --popsize 20
```

Usa optimización numérica (`scipy.differential_evolution`, vectorizada:
evalúa toda una generación de candidatos en una sola pasada por el modelo,
en vez de uno a uno) para buscar, dentro de los rangos del dataset, la
combinación que el modelo predice más cercana al objetivo, penalizando
inestabilidad y probabilidad de extinción. `--fix KEY=VALUE` deja algunos
parámetros constantes en la búsqueda. `--maxiter`/`--popsize` controlan
calidad vs. velocidad de la búsqueda.

### Evaluar

```bash
python train_model.py evaluate --model ./model
```

Solo imprime la importancia de cada parámetro sobre la población estable,
sin reentrenar.

### Verificar una sugerencia

El modelo predice, no simula — conviene siempre confirmar con
`batch-simulate.mjs` en modo `repeat` (ver sección 3) usando exactamente los
parámetros que `suggest`/`predict` mostró, y comparar la población final real
(promediada sobre varias corridas, por la aleatoriedad) contra la predicción.

### Notas de rendimiento

- Si `predict`/`suggest` se queda sin RAM o va muy lento con datasets
  grandes (miles de runs), el modelo entrenado (`model.joblib`) puede haberse
  vuelto muy pesado por árboles sin límite de profundidad. El script ya
  limita `max_depth=14` y baja `n_estimators`/`n_jobs` para mantenerlo
  liviano — si entrenaste con una versión anterior, reentrena.
- `suggest` evalúa la función objetivo de forma vectorizada (toda la
  generación de `differential_evolution` en una sola llamada al modelo), así
  que debería tardar segundos, no minutos, incluso con ~35 parámetros.

---

## 5. `page.tsx` — visor de runs

Página Next.js (requiere `npm install recharts`) para cargar uno o varios
`run-XXXX.json` / `final.json` / `timeseries.json` **desde el sistema de
archivos** (arrastrar y soltar o seleccionar) y compararlos:

- Una gráfica por métrica (población, energía media, edad media, radio
  medio, velocidad media, generación máxima), superponiendo todas las runs
  cargadas con un color distinto cada una.
- Tabla de **parámetros que difieren** entre las runs cargadas, para ver de
  un vistazo qué se cambió entre una corrida y otra.
- Cada run se puede ocultar o quitar sin recargar el archivo.

---

## Flujo de trabajo típico

1. **Generar el dataset**: `batch-simulate.mjs --mode random --all-params --samples 2000 --hours 6 --seconds-per-run 900`
2. **Entrenar**: `train_model.py train --dataset ./dataset --out ./model`
3. **Explorar**: `train_model.py evaluate` para ver qué parámetros importan; `predict`/`suggest` para probar hipótesis sin simular.
4. **Verificar**: correr `batch-simulate.mjs --runs 10` (modo `repeat`) con los parámetros sugeridos, y comparar la población real contra la predicción.
5. **Visualizar**: cargar las runs de verificación en `page.tsx` para inspeccionarlas gráficamente.



## Actualización!!

Ahora podremos practicar el 'active learning'

# Ronda 1: a ciegas, para entrenar el clasificador
node batch-simulate.mjs --mode random --all-params --samples 500 --seconds-per-run 900 --out ./ds/A
python train_model.py train --dataset ./ds/A --out ./model

# Ronda 2: la IA propone combinaciones que probablemente sobrevivan
python train_model.py sample-survivable --model ./model --count 500 \
  --pool-multiplier 20 --max-extinction-prob 0.3 --out ./combos.json

node batch-simulate.mjs --combos-file ./combos.json --seconds-per-run 900 --out ./ds/A-r-2
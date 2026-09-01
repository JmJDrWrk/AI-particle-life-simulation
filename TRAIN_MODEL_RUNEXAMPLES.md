pip install pandas numpy scikit-learn scipy joblib

python train_model.py train --dataset ./dataset-F --out ./model
python train_model.py predict --model ./model --param INITIAL_PARTICLES=400
python train_model.py suggest --model ./model --target-population 500


EXAMPLES

Aquí tienes ejemplos variados para probar, usando los parámetros reales de tu simulación:

predict — un solo parámetro

bash
python train_model.py predict --model ./model --param INITIAL_PARTICLES=400
python train_model.py predict --model ./model --param REPRODUCTION_CHANCE=0.9
python train_model.py predict --model ./model --param ENERGY_DRAIN_PER_SECOND=0.2

predict — combinando varios --param (repetible)

bash
python train_model.py predict --model ./model
  --param INITIAL_PARTICLES=300 
  --param REPRODUCTION_CHANCE=0.6 
  --param ENERGY_DRAIN_PER_SECOND=0.3

python train_model.py predict --model ./model --param INITIAL_PARTICLES=300  --param REPRODUCTION_CHANCE=0.6  --param ENERGY_DRAIN_PER_SECOND=0.3

python train_model.py predict --model ./model \
  --param MAX_PARTICLES=6000 \
  --param REPRODUCTION_SELF_MIN_ENERGY=80 \
  --param REPRODUCTION_PARTNER_MIN_ENERGY=70

predict — comparar extremos (útil para ver el efecto de un parámetro)

bash
python train_model.py predict --model ./model --param REPRODUCTION_CHANCE=0.05
python train_model.py predict --model ./model --param REPRODUCTION_CHANCE=1.0

suggest — distintos objetivos

bash
python train_model.py suggest --model ./model --target-population 500
python train_model.py suggest --model ./model --target-population 1000 --max-instability 0.1
python train_model.py suggest --model ./model --target-population 200 --max-instability 0.25

suggest — fijando algunos parámetros y dejando que busque el resto

bash
python train_model.py suggest --model ./model --target-population 500 \
  --fix INITIAL_PARTICLES=300

python train_model.py suggest --model ./model --target-population 500 \
  --fix INITIAL_PARTICLES=300 --fix MAX_PARTICLES=4000

evaluate — ver qué parámetros importan más

bash
python train_model.py evaluate --model ./model

Recuerda: los nombres de --param/--fix tienen que coincidir exactamente con las claves de params en tus run-XXXX.json (verás la lista completa impresa al final de train).





Gemini generated this command from a chart i manually picked up because liked its tendency and came with this

python train_model.py predict --model ./model --param INITIAL_PARTICLES=200 --param MAX_PARTICLES=10000 --param FOOD_MAX=100 --param WATER_MAX=100 --param INTERACTION_RADIUS=118.95157162837687 --param NEARBY_RADIUS_NORMALIZED=0.08063955020651753 --param MAX_DECISION_NEARBY=11 --param MIN_REPRODUCTION_AGE=4.47390501761803 --param REPRODUCTION_COOLDOWN=1.026773784377639 --param REPRODUCTION_CHANCE=0.8483938059822498 --param REPRODUCTION_SELF_MIN_ENERGY=11.695641407110626 --param REPRODUCTION_PARTNER_MIN_ENERGY=32.5303044506665 --param REPRODUCTION_SELF_COST=13.770886053332971 --param REPRODUCTION_PARTNER_COST=14.293760684040054 --param CHILD_INITIAL_ENERGY=66.96366386968671 --param ENERGY_DRAIN_PER_SECOND=1 --param MAX_SPEED=0.09578941152879522 --param MOVE_ACCELERATION=0.003227235731279113 --param SEPARATION_DISTANCE_MULTIPLIER=1.0842859115035495 --param SEPARATION_STRENGTH=0.040476026034176896 --param DECISION_RATE=3.722753814746295 --param SPEED_MULTIPLIER=1 --param INITIAL_LIFESPAN_MIN=34.275561036971204 --param INITIAL_LIFESPAN_MAX=94.85128613086636 --param INITIAL_ENERGY_MIN=78.26604006235087 --param INITIAL_ENERGY_MAX=79.45498636722016 --param CHILD_RADIUS_MUTATION=0.5 --param CHILD_VELOCITY_FACTOR=0.01 --param CHILD_POSITION_RANDOMNESS=0.01 --param CHILD_VELOCITY_RANDOMNESS=0.1 --param MIN_RADIUS=4.04078536771222 --param MAX_RADIUS=11.431742863935021 --param INITIAL_RADIUS_MIN=5.883201047389958 --param INITIAL_RADIUS_MAX=10.502962847457004 --param INITIAL_VELOCITY_MAX=0.1 --param POSITION_MARGIN=0.1


I Think this is the command to run the simulation with that data

node batch-simulate.mjs --runs 5 --seconds-per-run 100 --out ./verify-batch --param INITIAL_PARTICLES=200 --param MAX_PARTICLES=10000 --param FOOD_MAX=100 --param WATER_MAX=100 --param INTERACTION_RADIUS=118.95157162837687 --param NEARBY_RADIUS_NORMALIZED=0.08063955020651753 --param MAX_DECISION_NEARBY=11 --param MIN_REPRODUCTION_AGE=4.47390501761803 --param REPRODUCTION_COOLDOWN=1.026773784377639 --param REPRODUCTION_CHANCE=0.8483938059822498 --param REPRODUCTION_SELF_MIN_ENERGY=11.695641407110626 --param REPRODUCTION_PARTNER_MIN_ENERGY=32.5303044506665 --param REPRODUCTION_SELF_COST=13.770886053332971 --param REPRODUCTION_PARTNER_COST=14.293760684040054 --param CHILD_INITIAL_ENERGY=66.96366386968671 --param ENERGY_DRAIN_PER_SECOND=1 --param MAX_SPEED=0.09578941152879522 --param MOVE_ACCELERATION=0.003227235731279113 --param SEPARATION_DISTANCE_MULTIPLIER=1.0842859115035495 --param SEPARATION_STRENGTH=0.040476026034176896 --param DECISION_RATE=3.722753814746295 --param SPEED_MULTIPLIER=1 --param INITIAL_LIFESPAN_MIN=34.275561036971204 --param INITIAL_LIFESPAN_MAX=94.85128613086636 --param INITIAL_ENERGY_MIN=78.26604006235087 --param INITIAL_ENERGY_MAX=79.45498636722016 --param CHILD_RADIUS_MUTATION=0.5 --param CHILD_VELOCITY_FACTOR=0.01 --param CHILD_POSITION_RANDOMNESS=0.01 --param CHILD_VELOCITY_RANDOMNESS=0.1 --param MIN_RADIUS=4.04078536771222 --param MAX_RADIUS=11.431742863935021 --param INITIAL_RADIUS_MIN=5.883201047389958 --param INITIAL_RADIUS_MAX=10.502962847457004 --param INITIAL_VELOCITY_MAX=0.1 --param POSITION_MARGIN=0.1 